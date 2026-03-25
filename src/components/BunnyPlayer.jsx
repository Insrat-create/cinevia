import Hls from 'hls.js'
import { useEffect, useRef, useState } from 'react'
import { fetchBunnyPlaybackInfo } from '../utils/bunny'

const VOLUME_COLLAPSE_DELAY_MS = 1
const CONTROLS_HIDE_DELAY_MS = 2500
const PLAYBACK_SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2]
const PLAYBACK_QUALITY_OPTIONS = [360, 720, 1080]
const EMPTY_SUBTITLE_TRACKS = []
const SUBTITLE_OFF_OPTION = {
  id: 'subtitles-off',
  label: 'Off',
  kind: 'off',
}

function getSubtitleTrackFormat(track) {
  const explicitFormat = track?.format?.trim()?.toLowerCase()

  if (explicitFormat) {
    return explicitFormat
  }

  const normalizedSrc = track?.src?.split('?')[0]?.toLowerCase() ?? ''

  if (normalizedSrc.endsWith('.ass') || normalizedSrc.endsWith('.ssa')) {
    return 'ass'
  }

  if (normalizedSrc.endsWith('.srt')) {
    return 'srt'
  }

  return 'vtt'
}

function getAudioTrackLabel(track, index) {
  const name = track?.name?.trim()
  const language = track?.lang?.trim() || track?.language?.trim()

  if (name && language && name.toLowerCase() !== language.toLowerCase()) {
    return `${name} (${language.toUpperCase()})`
  }

  if (name) {
    return name
  }

  if (language) {
    return language.toUpperCase()
  }

  return `Track ${index + 1}`
}

function getAudioTrackLanguageCode(track) {
  const rawLanguage =
    track?.lang?.trim() ||
    track?.language?.trim() ||
    track?.srclang?.trim() ||
    track?.name?.trim() ||
    ''
  const normalizedLanguage = rawLanguage.toLowerCase()

  if (
    normalizedLanguage === 'japanese' ||
    normalizedLanguage === 'ja' ||
    normalizedLanguage.startsWith('ja-')
  ) {
    return 'ja'
  }

  if (
    normalizedLanguage === 'english' ||
    normalizedLanguage === 'en' ||
    normalizedLanguage.startsWith('en-')
  ) {
    return 'en'
  }

  return normalizedLanguage
}

function getNativeAudioTracks(video) {
  const trackList = video?.audioTracks

  if (!trackList?.length) {
    return []
  }

  return Array.from({ length: trackList.length }, (_, index) => trackList[index]).filter(Boolean)
}

function getSubtitleTrackLabel(track, index) {
  const label = track?.label?.trim()
  const language = track?.srclang?.trim() || track?.language?.trim() || track?.lang?.trim()

  if (label && language && label.toLowerCase() !== language.toLowerCase()) {
    return `${label} (${language.toUpperCase()})`
  }

  if (label) {
    return label
  }

  if (language) {
    return language.toUpperCase()
  }

  return `Subtitle ${index + 1}`
}

function getSubtitleTrackOptions(tracks = []) {
  return tracks
    .filter((track) => track?.src)
    .map((track, index) => ({
      default: Boolean(track.default),
      format: getSubtitleTrackFormat(track),
      id: track.id?.trim() || `subtitle-track-${index}`,
      kind: track.kind?.trim() || 'subtitles',
      label: getSubtitleTrackLabel(track, index),
      offsetSeconds: Number.isFinite(Number(track.offsetSeconds)) ? Number(track.offsetSeconds) : 0,
      src: encodeURI(track.src),
      srcLang: track.srclang?.trim() || track.language?.trim() || track.lang?.trim() || 'en',
    }))
}

function parseAssTimestamp(value) {
  if (!value) {
    return 0
  }

  const match = String(value).trim().match(/(\d+):(\d{2}):(\d{2})\.(\d{1,2})/)

  if (!match) {
    return 0
  }

  const [, hours, minutes, seconds, centiseconds] = match

  return (
    Number(hours) * 3600 +
    Number(minutes) * 60 +
    Number(seconds) +
    Number(centiseconds.padEnd(2, '0')) / 100
  )
}

function splitAssDialogueValues(value, expectedCount) {
  const parts = []
  let current = ''
  let separatorCount = 0

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]

    if (character === ',' && separatorCount < expectedCount - 1) {
      parts.push(current)
      current = ''
      separatorCount += 1
      continue
    }

    current += character
  }

  parts.push(current)
  return parts
}

function cleanAssText(value) {
  return String(value ?? '')
    .replace(/\{[^}]*\}/g, '')
    .replace(/\\N/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\h/g, ' ')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
}

function parseSrtTimestamp(value) {
  if (!value) {
    return 0
  }

  const match = String(value).trim().match(/(\d+):(\d{2}):(\d{2})[,.](\d{1,3})/)

  if (!match) {
    return 0
  }

  const [, hours, minutes, seconds, milliseconds] = match

  return (
    Number(hours) * 3600 +
    Number(minutes) * 60 +
    Number(seconds) +
    Number(milliseconds.padEnd(3, '0')) / 1000
  )
}

function cleanSrtText(value) {
  return String(value ?? '')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.replace(/<[^>]+>/g, '').trim())
    .filter(Boolean)
    .join('\n')
}

function parseSrtSubtitles(rawSrt, offsetSeconds = 0) {
  const blocks = String(rawSrt ?? '')
    .replace(/\r/g, '')
    .trim()
    .split(/\n{2,}/)
  const cues = []

  for (const block of blocks) {
    const lines = block
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)

    if (lines.length === 0) {
      continue
    }

    const timingLineIndex = lines.findIndex((line) => line.includes('-->'))

    if (timingLineIndex === -1) {
      continue
    }

    const timingLine = lines[timingLineIndex]
    const [rawStart, rawEnd] = timingLine.split('-->')

    if (!rawStart || !rawEnd) {
      continue
    }

    const text = cleanSrtText(lines.slice(timingLineIndex + 1).join('\n'))

    if (!text) {
      continue
    }

    const start = parseSrtTimestamp(rawStart.trim().split(/\s+/)[0]) + offsetSeconds
    const end = parseSrtTimestamp(rawEnd.trim().split(/\s+/)[0]) + offsetSeconds

    if (end <= 0) {
      continue
    }

    cues.push({
      end: Math.max(start, end),
      start: Math.max(0, start),
      text,
    })
  }

  return cues
}

function parseAssSubtitles(rawAss, offsetSeconds = 0) {
  const lines = String(rawAss ?? '').split(/\r?\n/)
  let isInsideEventsSection = false
  let dialogueFormat = []
  const cues = []

  for (const line of lines) {
    const trimmedLine = line.trim()

    if (!trimmedLine) {
      continue
    }

    if (trimmedLine.startsWith('[') && trimmedLine.endsWith(']')) {
      isInsideEventsSection = trimmedLine.toLowerCase() === '[events]'
      continue
    }

    if (!isInsideEventsSection) {
      continue
    }

    if (trimmedLine.startsWith('Format:')) {
      dialogueFormat = trimmedLine
        .slice('Format:'.length)
        .split(',')
        .map((item) => item.trim().toLowerCase())
      continue
    }

    if (!trimmedLine.startsWith('Dialogue:') || dialogueFormat.length === 0) {
      continue
    }

    const dialogueValues = splitAssDialogueValues(
      trimmedLine.slice('Dialogue:'.length).trim(),
      dialogueFormat.length
    )
    const getFieldValue = (fieldName) => dialogueValues[dialogueFormat.indexOf(fieldName)] ?? ''
    const rawText = getFieldValue('text')

    if (/\\p\d/i.test(rawText)) {
      continue
    }

    const text = cleanAssText(rawText)

    if (!text) {
      continue
    }

    const start = parseAssTimestamp(getFieldValue('start')) + offsetSeconds
    const end = parseAssTimestamp(getFieldValue('end')) + offsetSeconds

    if (end <= 0) {
      continue
    }

    cues.push({
      end: Math.max(start, end),
      start: Math.max(0, start),
      text,
    })
  }

  return cues
}

function getActiveSubtitleText(cues, timeInSeconds) {
  if (!cues.length || !Number.isFinite(timeInSeconds)) {
    return ''
  }

  const activeTexts = []

  for (const cue of cues) {
    if (cue.start > timeInSeconds) {
      break
    }

    if (cue.start <= timeInSeconds && cue.end >= timeInSeconds) {
      activeTexts.push(cue.text)
    }
  }

  return activeTexts.join('\n').trim()
}

function isKeyboardShortcutBlockingElement(element) {
  if (!element) {
    return false
  }

  if (
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement ||
    element.isContentEditable
  ) {
    return true
  }

  if (!(element instanceof HTMLInputElement)) {
    return false
  }

  const inputType = element.type?.trim().toLowerCase() || 'text'

  return ![
    'button',
    'checkbox',
    'color',
    'file',
    'hidden',
    'image',
    'radio',
    'range',
    'reset',
    'submit',
  ].includes(inputType)
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '0:00'
  }

  const totalSeconds = Math.floor(seconds)
  const minutes = Math.floor(totalSeconds / 60)
  const hours = Math.floor(minutes / 60)
  const displayMinutes = hours > 0 ? minutes % 60 : minutes
  const displaySeconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}:${String(displayMinutes).padStart(2, '0')}:${String(displaySeconds).padStart(2, '0')}`
  }

  return `${displayMinutes}:${String(displaySeconds).padStart(2, '0')}`
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 6.5L18 12 8 17.5V6.5z" fill="currentColor" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 6h4v12H7zM13 6h4v12h-4z" fill="currentColor" />
    </svg>
  )
}

function FullscreenIcon({ active }) {
  return active ? (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M9 9H5V5h2v2h2v2zm8 0V7h2V5h-4v4h2zm-8 6H7v2H5v2h4v-4zm10 0h-2v2h-2v2h4v-4z"
        fill="currentColor"
      />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M5 9V5h4v2H7v2H5zm10-4h4v4h-2V7h-2V5zM7 15v2h2v2H5v-4h2zm10 2v-2h2v4h-4v-2h2z"
        fill="currentColor"
      />
    </svg>
  )
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M19.14 12.94a7.7 7.7 0 000-1.88l2.03-1.58-1.92-3.32-2.44.74a7.44 7.44 0 00-1.63-.95L14.8 3h-3.6l-.38 2.95a7.44 7.44 0 00-1.63.95l-2.44-.74-1.92 3.32 2.03 1.58a7.7 7.7 0 000 1.88l-2.03 1.58 1.92 3.32 2.44-.74c.5.39 1.05.71 1.63.95l.38 2.95h3.6l.38-2.95c.58-.24 1.13-.56 1.63-.95l2.44.74 1.92-3.32-2.03-1.58zM12 15.25A3.25 3.25 0 1112 8.75a3.25 3.25 0 010 6.5z"
        fill="currentColor"
      />
    </svg>
  )
}

function SubtitlesIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M5 6h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2zm1.5 4.25h4v1.5h-4v-1.5zm0 3h6v1.5h-6v-1.5zm8-3h3v1.5h-3v-1.5zm0 3h3v1.5h-3v-1.5z"
        fill="currentColor"
      />
    </svg>
  )
}

function EpisodesIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4 5h6v6H4V5zm10 0h6v2h-6V5zm0 4h6v2h-6V9zM4 13h6v6H4v-6zm10 0h6v2h-6v-2zm0 4h6v2h-6v-2z"
        fill="currentColor"
      />
    </svg>
  )
}

function VolumeIcon({ muted = false }) {
  if (muted) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M4 10h4l5-4v12l-5-4H4v-4zm10.5-.5l5 5m0-5l-5 5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4 10h4l5-4v12l-5-4H4v-4zm11.5-1.5a4 4 0 010 7M17.5 6a8 8 0 010 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function BunnyPlayer({
  hasBlockingPanelOpen = false,
  initialResumeTime = 0,
  isFullscreen = false,
  onEnded,
  onDismissBlockingPanels,
  onEpisodesClick,
  onNearEnd,
  onProgressChange,
  onControlsVisibilityChange,
  onToggleFullscreen,
  onVideoRefReady,
  showEpisodesButton = false,
  shouldAutoplay = false,
  subtitle,
  subtitleTracks = EMPTY_SUBTITLE_TRACKS,
  preferredAudioLanguage = null,
  preferredSubtitleMode = null,
  title,
  videoId,
}) {
  const videoRef = useRef(null)
  const hlsRef = useRef(null)
  const hideControlsTimeoutRef = useRef(null)
  const volumeCollapseTimeoutRef = useRef(null)
  const isVolumeHoveredRef = useRef(false)
  const settingsPanelRef = useRef(null)
  const settingsButtonRef = useRef(null)
  const subtitlesPanelRef = useRef(null)
  const subtitlesButtonRef = useRef(null)
  const onEndedRef = useRef(onEnded)
  const onNearEndRef = useRef(onNearEnd)
  const onProgressChangeRef = useRef(onProgressChange)
  const initialResumeTimeRef = useRef(initialResumeTime)
  const hasAppliedInitialResumeRef = useRef(false)
  const hasTriggeredNearEndRef = useRef(false)
  const uiFrameRef = useRef(null)
  const playbackSnapshotRef = useRef({
    currentTime: 0,
    duration: 0,
    lastProgress: -1,
  })
  const hasAttemptedAutoplayRef = useRef(false)
  const hasPendingResumeAutoplayRef = useRef(false)
  const lastAudibleVolumeRef = useRef(1)
  const parsedSubtitleCacheRef = useRef(new Map())
  const [playbackInfo, setPlaybackInfo] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [areControlsVisible, setAreControlsVisible] = useState(true)
  const [isVolumeExpanded, setIsVolumeExpanded] = useState(true)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isSubtitlesOpen, setIsSubtitlesOpen] = useState(false)
  const [selectedSettingsTab, setSelectedSettingsTab] = useState('speed')
  const [playbackRate, setPlaybackRate] = useState(1)
  const [selectedQuality, setSelectedQuality] = useState(1080)
  const [audioOptions, setAudioOptions] = useState([])
  const [selectedAudioTrackId, setSelectedAudioTrackId] = useState('')
  const [selectedSubtitleTrackId, setSelectedSubtitleTrackId] = useState(SUBTITLE_OFF_OPTION.id)
  const [parsedSubtitleCues, setParsedSubtitleCues] = useState([])
  const [isParsedSubtitleLoading, setIsParsedSubtitleLoading] = useState(false)
  const [parsedSubtitleLoadError, setParsedSubtitleLoadError] = useState('')
  const subtitleOptions = getSubtitleTrackOptions(subtitleTracks)
  const nativeSubtitleOptions = subtitleOptions.filter((track) => track.format === 'vtt')
  const selectedSubtitleOption =
    subtitleOptions.find((track) => track.id === selectedSubtitleTrackId) ?? null
  const selectedSubtitleTrackOffsetSeconds = selectedSubtitleOption?.offsetSeconds ?? 0
  const selectedSubtitleTrackSrc = selectedSubtitleOption?.src ?? ''
  const hasSubtitleTrackSupport = subtitleOptions.length > 0
  const selectedSubtitleTrackFormat = selectedSubtitleOption?.format ?? null
  const areOverlayPanelsOpen = isSettingsOpen || isSubtitlesOpen
  const areSubtitlesEnabled = selectedSubtitleTrackId !== SUBTITLE_OFF_OPTION.id
  const isUsingParsedSubtitles =
    areSubtitlesEnabled &&
    (selectedSubtitleTrackFormat === 'ass' || selectedSubtitleTrackFormat === 'srt')
  const activeParsedSubtitleText =
    isUsingParsedSubtitles && !isParsedSubtitleLoading
      ? getActiveSubtitleText(parsedSubtitleCues, currentTime)
      : ''

  const updateVolume = (nextVolume) => {
    const normalizedVolume = Math.min(1, Math.max(0, nextVolume))
    setVolume(normalizedVolume)

    if (normalizedVolume > 0) {
      lastAudibleVolumeRef.current = normalizedVolume
    }

    return normalizedVolume
  }

  const applyQualitySelection = (targetHeight, hlsInstance = hlsRef.current) => {
    setSelectedQuality(targetHeight)

    if (!hlsInstance?.levels?.length) {
      return
    }

    let bestLevelIndex = 0
    let bestLevelDelta = Number.POSITIVE_INFINITY

    hlsInstance.levels.forEach((level, index) => {
      const levelHeight = level.height || 0
      const levelDelta = Math.abs(levelHeight - targetHeight)

      if (levelDelta < bestLevelDelta) {
        bestLevelDelta = levelDelta
        bestLevelIndex = index
      }
    })

    hlsInstance.currentLevel = bestLevelIndex
    hlsInstance.nextLevel = bestLevelIndex
  }

  const applyAudioOptions = (nextOptions = []) => {
    setAudioOptions(nextOptions)
    setSelectedAudioTrackId((currentTrackId) => {
      if (nextOptions.some((option) => option.id === currentTrackId)) {
        return currentTrackId
      }

      return nextOptions.find((option) => option.isActive)?.id ?? nextOptions[0]?.id ?? ''
    })
  }

  const handleAudioTrackSelection = (audioTrackId) => {
    const selectedOption = audioOptions.find((option) => option.id === audioTrackId)

    if (!selectedOption) {
      return
    }

    setSelectedAudioTrackId(audioTrackId)

    if (selectedOption.source === 'hls' && hlsRef.current) {
      hlsRef.current.audioTrack = selectedOption.trackIndex
      return
    }

    if (selectedOption.source === 'native') {
      const nativeTracks = getNativeAudioTracks(videoRef.current)

      nativeTracks.forEach((track, index) => {
        track.enabled = index === selectedOption.trackIndex
      })
    }
  }

  const syncSubtitleTrackModes = () => {
    const subtitleTrackElements = Array.from(
      videoRef.current?.querySelectorAll('track[data-player-subtitle-track="true"]') ?? []
    )

    subtitleTrackElements.forEach((trackElement) => {
      const trackId = trackElement.getAttribute('data-track-id')

      if (trackElement.track) {
        trackElement.track.mode =
          trackId === selectedSubtitleTrackId ? 'showing' : 'disabled'
      }
    })
  }

  useEffect(() => {
    onEndedRef.current = onEnded
  }, [onEnded])

  useEffect(() => {
    onNearEndRef.current = onNearEnd
  }, [onNearEnd])

  useEffect(() => {
    onProgressChangeRef.current = onProgressChange
  }, [onProgressChange])

  useEffect(() => {
    initialResumeTimeRef.current = initialResumeTime
  }, [initialResumeTime])

  useEffect(() => {
    setSelectedSubtitleTrackId((currentTrackId) => {
      if (preferredSubtitleMode === 'off') {
        return SUBTITLE_OFF_OPTION.id
      }

      if (preferredSubtitleMode === 'on') {
        return subtitleOptions.find((track) => track.default)?.id ?? subtitleOptions[0]?.id ?? SUBTITLE_OFF_OPTION.id
      }

      if (subtitleOptions.some((track) => track.id === currentTrackId)) {
        return currentTrackId
      }

      return subtitleOptions.find((track) => track.default)?.id ?? SUBTITLE_OFF_OPTION.id
    })
  }, [preferredSubtitleMode, subtitleTracks, videoId])

  useEffect(() => {
    if (!preferredAudioLanguage || audioOptions.length === 0) {
      return
    }

    const currentAudioOption = audioOptions.find((option) => option.id === selectedAudioTrackId)

    if (currentAudioOption?.languageCode === preferredAudioLanguage) {
      return
    }

    const preferredAudioOption = audioOptions.find(
      (option) => option.languageCode === preferredAudioLanguage
    )

    if (!preferredAudioOption || preferredAudioOption.id === selectedAudioTrackId) {
      return
    }

    handleAudioTrackSelection(preferredAudioOption.id)
  }, [audioOptions, preferredAudioLanguage, selectedAudioTrackId, videoId])

  useEffect(() => {
    let isCancelled = false

    if (!isUsingParsedSubtitles || !selectedSubtitleTrackSrc) {
      setParsedSubtitleCues([])
      setIsParsedSubtitleLoading(false)
      setParsedSubtitleLoadError('')
      return undefined
    }

    const cacheKey = `${selectedSubtitleTrackId}:${selectedSubtitleTrackSrc}:${selectedSubtitleTrackOffsetSeconds}`
    const cachedParsedSubtitles = parsedSubtitleCacheRef.current.get(cacheKey)

    if (cachedParsedSubtitles) {
      setParsedSubtitleCues(cachedParsedSubtitles)
      setIsParsedSubtitleLoading(false)
      setParsedSubtitleLoadError('')
      return undefined
    }

    setParsedSubtitleCues([])
    setIsParsedSubtitleLoading(true)
    setParsedSubtitleLoadError('')

    const loadParsedSubtitles = async () => {
      try {
        const response = await fetch(selectedSubtitleTrackSrc)

        if (!response.ok) {
          throw new Error(`Unable to fetch subtitle track: ${response.status}`)
        }

        const rawSubtitleText = await response.text()

        if (isCancelled) {
          return
        }

        const nextParsedSubtitles =
          selectedSubtitleTrackFormat === 'srt'
            ? parseSrtSubtitles(rawSubtitleText, selectedSubtitleTrackOffsetSeconds)
            : parseAssSubtitles(rawSubtitleText, selectedSubtitleTrackOffsetSeconds)
        parsedSubtitleCacheRef.current.set(cacheKey, nextParsedSubtitles)
        setParsedSubtitleCues(nextParsedSubtitles)
        setIsParsedSubtitleLoading(false)
      } catch {
        if (isCancelled) {
          return
        }

        setParsedSubtitleCues([])
        setIsParsedSubtitleLoading(false)
        setParsedSubtitleLoadError('This subtitle track could not be loaded.')
      }
    }

    void loadParsedSubtitles()

    return () => {
      isCancelled = true
    }
  }, [
    isUsingParsedSubtitles,
    selectedSubtitleTrackFormat,
    selectedSubtitleTrackId,
    selectedSubtitleTrackOffsetSeconds,
    selectedSubtitleTrackSrc,
  ])

  useEffect(() => {
    onControlsVisibilityChange?.(areControlsVisible)
  }, [areControlsVisible, onControlsVisibilityChange])

  useEffect(() => {
    onVideoRefReady?.(videoRef.current)

    return () => {
      onVideoRefReady?.(null)
    }
  }, [onVideoRefReady])

  useEffect(() => {
    let isCancelled = false

    const loadPlaybackInfo = async () => {
      setIsLoading(true)
      hasTriggeredNearEndRef.current = false
      applyAudioOptions([])
      setParsedSubtitleCues([])
      setIsParsedSubtitleLoading(false)
      setParsedSubtitleLoadError('')
      setIsSettingsOpen(false)
      setIsSubtitlesOpen(false)
      const nextPlaybackInfo = await fetchBunnyPlaybackInfo(videoId)

      if (isCancelled) {
        return
      }

      setPlaybackInfo(nextPlaybackInfo)
      setIsLoading(false)
    }

    void loadPlaybackInfo()

    return () => {
      isCancelled = true
    }
  }, [videoId])

  useEffect(() => {
    hasAttemptedAutoplayRef.current = false
    hasPendingResumeAutoplayRef.current = false
  }, [shouldAutoplay, videoId])

  useEffect(() => {
    hasAppliedInitialResumeRef.current = false
  }, [videoId])

  useEffect(() => {
    return () => {
      if (uiFrameRef.current) {
        cancelAnimationFrame(uiFrameRef.current)
        uiFrameRef.current = null
      }

      if (hideControlsTimeoutRef.current) {
        clearTimeout(hideControlsTimeoutRef.current)
        hideControlsTimeoutRef.current = null
      }

      if (volumeCollapseTimeoutRef.current) {
        clearTimeout(volumeCollapseTimeoutRef.current)
        volumeCollapseTimeoutRef.current = null
      }
    }
  }, [])

  const scheduleVolumeCollapse = (delay = VOLUME_COLLAPSE_DELAY_MS) => {
    if (volumeCollapseTimeoutRef.current) {
      clearTimeout(volumeCollapseTimeoutRef.current)
      volumeCollapseTimeoutRef.current = null
    }

    if (isVolumeHoveredRef.current) {
      return
    }

    volumeCollapseTimeoutRef.current = setTimeout(() => {
      if (isVolumeHoveredRef.current) {
        volumeCollapseTimeoutRef.current = null
        return
      }

      setIsVolumeExpanded(false)
      volumeCollapseTimeoutRef.current = null
    }, delay)
  }

  const revealVolumeSlider = () => {
    setIsVolumeExpanded(true)

    if (volumeCollapseTimeoutRef.current) {
      clearTimeout(volumeCollapseTimeoutRef.current)
      volumeCollapseTimeoutRef.current = null
    }
  }

  const handleVolumeMouseEnter = () => {
    isVolumeHoveredRef.current = true
    revealVolumeSlider()
  }

  const handleVolumeMouseLeave = () => {
    isVolumeHoveredRef.current = false
    scheduleVolumeCollapse()
  }

  useEffect(() => {
    if (!areControlsVisible) {
      if (volumeCollapseTimeoutRef.current) {
        clearTimeout(volumeCollapseTimeoutRef.current)
        volumeCollapseTimeoutRef.current = null
      }

      isVolumeHoveredRef.current = false
      return
    }

    if (isVolumeExpanded) {
      scheduleVolumeCollapse()
    }
  }, [areControlsVisible, isVolumeExpanded])

  useEffect(() => {
    if (hideControlsTimeoutRef.current) {
      clearTimeout(hideControlsTimeoutRef.current)
      hideControlsTimeoutRef.current = null
    }

    if (!isPlaying || areOverlayPanelsOpen) {
      setAreControlsVisible(true)
      return
    }

    if (!areControlsVisible) {
      return
    }

    hideControlsTimeoutRef.current = setTimeout(() => {
      setAreControlsVisible(false)
      hideControlsTimeoutRef.current = null
    }, CONTROLS_HIDE_DELAY_MS)

    return () => {
      if (hideControlsTimeoutRef.current) {
        clearTimeout(hideControlsTimeoutRef.current)
        hideControlsTimeoutRef.current = null
      }
    }
  }, [areControlsVisible, areOverlayPanelsOpen, isPlaying])

  useEffect(() => {
    const video = videoRef.current

    if (!video || !playbackInfo?.hlsUrl) {
      return undefined
    }

    const queueUiSync = () => {
      if (uiFrameRef.current) {
        return
      }

      uiFrameRef.current = requestAnimationFrame(() => {
        uiFrameRef.current = null
        setCurrentTime(playbackSnapshotRef.current.currentTime)
        setDuration(playbackSnapshotRef.current.duration)
      })
    }

    const reportPlaybackProgress = (force = false) => {
      const snapshotDuration =
        Number.isFinite(video.duration) && video.duration > 0
          ? video.duration
          : playbackSnapshotRef.current.duration
      const snapshotCurrentTime = Number.isFinite(video.currentTime)
        ? video.currentTime
        : playbackSnapshotRef.current.currentTime

      if (!Number.isFinite(snapshotCurrentTime) || snapshotCurrentTime < 0) {
        return
      }

      const nextProgress =
        snapshotDuration > 0
          ? Math.min(100, Math.max(0, Math.round((snapshotCurrentTime / snapshotDuration) * 100)))
          : Math.max(0, playbackSnapshotRef.current.lastProgress)

      playbackSnapshotRef.current.currentTime = snapshotCurrentTime
      playbackSnapshotRef.current.duration = snapshotDuration

      if (nextProgress !== playbackSnapshotRef.current.lastProgress) {
        playbackSnapshotRef.current.lastProgress = nextProgress
      }

      onProgressChangeRef.current?.({
        currentTime: snapshotCurrentTime,
        duration: snapshotDuration,
        force,
        progress: nextProgress,
      })
    }

    const handleTimeUpdate = () => {
      if (!video.duration || Number.isNaN(video.duration)) {
        return
      }

      playbackSnapshotRef.current.currentTime = video.currentTime
      playbackSnapshotRef.current.duration = video.duration
      queueUiSync()

      const nextProgress = Math.min(
        100,
        Math.max(0, Math.round((video.currentTime / video.duration) * 100))
      )
      const remainingSeconds = Math.max(0, video.duration - video.currentTime)

      if (nextProgress !== playbackSnapshotRef.current.lastProgress) {
        playbackSnapshotRef.current.lastProgress = nextProgress
      }

      reportPlaybackProgress()

      if (!hasTriggeredNearEndRef.current && (remainingSeconds <= 45 || nextProgress >= 92)) {
        hasTriggeredNearEndRef.current = true
        onNearEndRef.current?.()
      }
    }

    const handleEnded = () => {
      hasTriggeredNearEndRef.current = true
      setIsPlaying(false)
      playbackSnapshotRef.current.currentTime = video.duration || 0
      playbackSnapshotRef.current.duration = video.duration || 0
      playbackSnapshotRef.current.lastProgress = 100
      queueUiSync()
      onProgressChangeRef.current?.(100)
      onEndedRef.current?.()
    }

    const tryAutoplay = async () => {
      if (!shouldAutoplay || hasAttemptedAutoplayRef.current || !video.paused) {
        return
      }

      hasAttemptedAutoplayRef.current = true

      try {
        await video.play()
      } catch {
        hasAttemptedAutoplayRef.current = false
      }
    }

    const applyInitialResumeTime = () => {
      if (hasAppliedInitialResumeRef.current) {
        return
      }

      const normalizedResumeTime = Number(initialResumeTimeRef.current)

      if (!Number.isFinite(normalizedResumeTime) || normalizedResumeTime <= 0) {
        hasAppliedInitialResumeRef.current = true
        return
      }

      const hasKnownDuration = Number.isFinite(video.duration) && video.duration > 0
      const maxResumeTime = hasKnownDuration
        ? Math.max(0, Math.min(normalizedResumeTime, Math.max(0, video.duration - 2)))
        : Math.max(0, normalizedResumeTime)

      if (maxResumeTime <= 0) {
        hasAppliedInitialResumeRef.current = true
        return
      }

      if (shouldAutoplay) {
        hasAttemptedAutoplayRef.current = false
        hasPendingResumeAutoplayRef.current = true
      }

      video.currentTime = maxResumeTime
      playbackSnapshotRef.current.currentTime = maxResumeTime
      setCurrentTime(maxResumeTime)
      hasAppliedInitialResumeRef.current = true
      queueUiSync()
    }

    const syncNativeAudioOptions = () => {
      const nativeAudioOptions = getNativeAudioTracks(video).map((track, index) => ({
        id: `native-audio-${index}`,
        isActive: Boolean(track.enabled),
        label: getAudioTrackLabel(track, index),
        languageCode: getAudioTrackLanguageCode(track),
        source: 'native',
        trackIndex: index,
      }))

      if (!nativeAudioOptions.length) {
        return false
      }

      applyAudioOptions(nativeAudioOptions)
      return true
    }

    const syncHlsAudioOptions = (hlsInstance = hlsRef.current) => {
      const hlsAudioOptions = (hlsInstance?.audioTracks ?? []).map((track, index) => ({
        id: `hls-audio-${index}`,
        isActive: index === hlsInstance.audioTrack,
        label: getAudioTrackLabel(track, index),
        languageCode: getAudioTrackLanguageCode(track),
        source: 'hls',
        trackIndex: index,
      }))

      if (!hlsAudioOptions.length) {
        return false
      }

      applyAudioOptions(hlsAudioOptions)
      return true
    }

    const syncAvailableAudioOptions = () => {
      if (syncHlsAudioOptions()) {
        return
      }

      if (syncNativeAudioOptions()) {
        return
      }

      applyAudioOptions([])
    }

    const handleLoadedData = () => {
      setIsLoading(false)
      playbackSnapshotRef.current.duration = video.duration || 0
      applyInitialResumeTime()
      queueUiSync()
      syncAvailableAudioOptions()
      void tryAutoplay()
    }

    const handleCanPlay = () => {
      applyInitialResumeTime()
      syncAvailableAudioOptions()
      void tryAutoplay()
    }

    const handleLoadedMetadata = () => {
      applyInitialResumeTime()
      syncAvailableAudioOptions()
      syncSubtitleTrackModes()
      void tryAutoplay()
    }

    const handlePlay = () => {
      hasPendingResumeAutoplayRef.current = false
      setIsPlaying(true)
    }
    const handlePause = () => {
      hasPendingResumeAutoplayRef.current = false
      setIsPlaying(false)
      reportPlaybackProgress(true)
    }
    const handleSeeked = () => {
      playbackSnapshotRef.current.currentTime = video.currentTime
      queueUiSync()

      if (hasPendingResumeAutoplayRef.current) {
        void tryAutoplay()
      }
    }

    const handlePageHide = () => {
      reportPlaybackProgress(true)
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        reportPlaybackProgress(true)
      }
    }

    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('ended', handleEnded)
    video.addEventListener('loadeddata', handleLoadedData)
    video.addEventListener('loadedmetadata', handleLoadedMetadata)
    video.addEventListener('canplay', handleCanPlay)
    video.addEventListener('play', handlePlay)
    video.addEventListener('pause', handlePause)
    video.addEventListener('seeked', handleSeeked)
    window.addEventListener('pagehide', handlePageHide)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
      })

      hlsRef.current = hls

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        applyQualitySelection(selectedQuality, hls)
        syncHlsAudioOptions()
      })
      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, syncHlsAudioOptions)
      hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, syncHlsAudioOptions)
      hls.loadSource(playbackInfo.hlsUrl)
      hls.attachMedia(video)
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = playbackInfo.hlsUrl
    } else {
      video.src = playbackInfo.mp4Url
    }

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('ended', handleEnded)
      video.removeEventListener('loadeddata', handleLoadedData)
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      video.removeEventListener('canplay', handleCanPlay)
      video.removeEventListener('play', handlePlay)
      video.removeEventListener('pause', handlePause)
      video.removeEventListener('seeked', handleSeeked)
      window.removeEventListener('pagehide', handlePageHide)
      document.removeEventListener('visibilitychange', handleVisibilityChange)

      reportPlaybackProgress(true)

      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }

      if (uiFrameRef.current) {
        cancelAnimationFrame(uiFrameRef.current)
        uiFrameRef.current = null
      }

      video.removeAttribute('src')
      video.load()
    }
  }, [playbackInfo, selectedQuality])

  useEffect(() => {
    const video = videoRef.current
    const normalizedResumeTime = Number(initialResumeTime)

    if (
      !video ||
      hasAppliedInitialResumeRef.current ||
      !Number.isFinite(normalizedResumeTime) ||
      normalizedResumeTime <= 0 ||
      !Number.isFinite(video.duration) ||
      video.duration <= 0
    ) {
      return
    }

    const maxResumeTime = Math.max(
      0,
      Math.min(normalizedResumeTime, Math.max(0, video.duration - 2))
    )

    if (maxResumeTime <= 0) {
      hasAppliedInitialResumeRef.current = true
      return
    }

    if (shouldAutoplay) {
      hasAttemptedAutoplayRef.current = false
      hasPendingResumeAutoplayRef.current = true
    }

    video.currentTime = maxResumeTime
    playbackSnapshotRef.current.currentTime = maxResumeTime
    setCurrentTime(maxResumeTime)
    hasAppliedInitialResumeRef.current = true
  }, [initialResumeTime, shouldAutoplay, videoId])

  useEffect(() => {
    const video = videoRef.current

    if (!video || !playbackInfo?.hlsUrl || !shouldAutoplay || hasAttemptedAutoplayRef.current) {
      return
    }

    const tryAutoplay = async () => {
      if (!video.paused) {
        hasAttemptedAutoplayRef.current = true
        return
      }

      hasAttemptedAutoplayRef.current = true

      try {
        await video.play()
      } catch {
        hasAttemptedAutoplayRef.current = false
      }
    }

    void tryAutoplay()
  }, [playbackInfo, shouldAutoplay, videoId])

  useEffect(() => {
    const video = videoRef.current

    if (!video) {
      return
    }

    video.volume = volume
    video.muted = volume === 0
  }, [volume])

  useEffect(() => {
    const video = videoRef.current

    if (!video) {
      return
    }

    video.playbackRate = playbackRate
  }, [playbackRate])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    let animationFrameId = window.requestAnimationFrame(() => {
      animationFrameId = null
      syncSubtitleTrackModes()
    })

    const video = videoRef.current

    if (!video) {
      return () => {
        if (animationFrameId !== null) {
          window.cancelAnimationFrame(animationFrameId)
        }
      }
    }

    const handleLoadedMetadata = () => {
      syncSubtitleTrackModes()
    }

    video.addEventListener('loadedmetadata', handleLoadedMetadata)

    return () => {
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId)
      }

      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
    }
  }, [selectedSubtitleTrackId, subtitleTracks, videoId])

  useEffect(() => {
    if (!areOverlayPanelsOpen) {
      return
    }

    const handlePointerDown = (event) => {
      const target = event.target

      if (
        settingsPanelRef.current?.contains(target) ||
        settingsButtonRef.current?.contains(target) ||
        subtitlesPanelRef.current?.contains(target) ||
        subtitlesButtonRef.current?.contains(target)
      ) {
        return
      }

      setIsSettingsOpen(false)
      setIsSubtitlesOpen(false)
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsSettingsOpen(false)
        setIsSubtitlesOpen(false)
      }
    }

    document.addEventListener('click', handlePointerDown)
    window.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('click', handlePointerDown)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [areOverlayPanelsOpen])

  if (!videoId) {
    return <p>Video is not available yet.</p>
  }

  const togglePlayback = async () => {
    const video = videoRef.current

    if (!video) {
      return
    }

    try {
      if (video.paused) {
        await video.play()
      } else {
        video.pause()
      }
    } catch {
      // Ignore playback failures.
    }
  }

  const handleSeek = (event) => {
    const video = videoRef.current
    const nextTime = Number(event.target.value)

    playbackSnapshotRef.current.currentTime = nextTime
    setCurrentTime(nextTime)

    if (!video || Number.isNaN(nextTime)) {
      return
    }

    video.currentTime = nextTime
  }

  const handleVolumeChange = (event) => {
    const nextVolume = Number(event.target.value)
    revealVolumeSlider()
    updateVolume(Number.isNaN(nextVolume) ? 1 : nextVolume)
    scheduleVolumeCollapse()
  }

  const skipBy = (seconds) => {
    const video = videoRef.current

    if (!video || !Number.isFinite(video.duration)) {
      return
    }

    const nextTime = Math.min(video.duration, Math.max(0, video.currentTime + seconds))
    video.currentTime = nextTime
    playbackSnapshotRef.current.currentTime = nextTime
    setCurrentTime(nextTime)
  }

  const revealControls = () => {
    setAreControlsVisible(true)

    if (hideControlsTimeoutRef.current) {
      clearTimeout(hideControlsTimeoutRef.current)
      hideControlsTimeoutRef.current = null
    }

    if (!isPlaying || areOverlayPanelsOpen) {
      return
    }

    hideControlsTimeoutRef.current = setTimeout(() => {
      setAreControlsVisible(false)
      hideControlsTimeoutRef.current = null
    }, CONTROLS_HIDE_DELAY_MS)
  }

  const handleSurfaceClick = async () => {
    if (areOverlayPanelsOpen || hasBlockingPanelOpen) {
      if (isSettingsOpen) {
        setIsSettingsOpen(false)
      }

      if (isSubtitlesOpen) {
        setIsSubtitlesOpen(false)
      }

      onDismissBlockingPanels?.()
      setAreControlsVisible(true)
      return
    }

    await togglePlayback()
  }

  const blurPlayerControl = (target) => {
    if (typeof window === 'undefined' || !(target instanceof Element)) {
      return
    }

    const interactiveElement = target.closest('button, input, [role="tab"]')

    if (!(interactiveElement instanceof HTMLElement)) {
      return
    }

    window.requestAnimationFrame(() => {
      interactiveElement.blur()
    })
  }

  useEffect(() => {
    const handleKeyDown = (event) => {
      const activeElement = document.activeElement
      const isTypingTarget = isKeyboardShortcutBlockingElement(activeElement)

      if (isTypingTarget || event.altKey || event.ctrlKey || event.metaKey) {
        return
      }

      if (
        event.key !== ' ' &&
        event.key !== 'Spacebar' &&
        event.key !== 'ArrowRight' &&
        event.key !== 'ArrowLeft' &&
        event.key !== 'ArrowUp' &&
        event.key !== 'ArrowDown' &&
        event.key.toLowerCase() !== 'c' &&
        event.key.toLowerCase() !== 'm' &&
        event.key.toLowerCase() !== 'f'
      ) {
        return
      }

      event.preventDefault()

      if (event.key === ' ' || event.key === 'Spacebar') {
        void togglePlayback()
        return
      }

      if (event.key === 'ArrowRight') {
        skipBy(10)
        return
      }

      if (event.key === 'ArrowLeft') {
        skipBy(-10)
        return
      }

      if (event.key === 'ArrowUp') {
        updateVolume(volume + 0.1)
        return
      }

      if (event.key === 'ArrowDown') {
        updateVolume(volume - 0.1)
        return
      }

      if (event.key.toLowerCase() === 'f') {
        onToggleFullscreen?.()
        return
      }

      if (event.key.toLowerCase() === 'c') {
        if (!hasSubtitleTrackSupport) {
          setIsSettingsOpen(false)
          setIsSubtitlesOpen((current) => !current)
          return
        }

        setSelectedSubtitleTrackId((currentTrackId) =>
          currentTrackId === SUBTITLE_OFF_OPTION.id
            ? subtitleOptions.find((track) => track.default)?.id ??
              subtitleOptions[0]?.id ??
              SUBTITLE_OFF_OPTION.id
            : SUBTITLE_OFF_OPTION.id
        )
        return
      }

      if (event.key.toLowerCase() === 'm') {
        if (volume === 0) {
          updateVolume(lastAudibleVolumeRef.current || 1)
          return
        }

        updateVolume(0)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [hasSubtitleTrackSupport, subtitleTracks, videoId, volume])

  const seekFillPercent =
    duration > 0 ? `${Math.min(100, Math.max(0, (currentTime / duration) * 100))}%` : '0%'
  const volumeFillPercent = `${Math.min(100, Math.max(0, volume * 100))}%`

  return (
    <div
      className={`bunny-player-wrap ${areControlsVisible ? 'controls-visible' : 'controls-hidden'}`}
      onClickCapture={(event) => blurPlayerControl(event.target)}
      onMouseMove={revealControls}
      onPointerUpCapture={(event) => blurPlayerControl(event.target)}
      onTouchStart={revealControls}
    >
      {isLoading && <div className="custom-player-loading">Loading stream...</div>}

      <video
        ref={videoRef}
        className="bunny-player custom-video-player"
        aria-label={title}
        onClick={handleSurfaceClick}
        crossOrigin="anonymous"
        playsInline
        preload="metadata"
        poster={playbackInfo?.posterUrl ?? ''}
      >
        {nativeSubtitleOptions.map((track) => (
          <track
            key={track.id}
            data-player-subtitle-track="true"
            data-track-id={track.id}
            kind={track.kind}
            label={track.label}
            src={track.src}
            srcLang={track.srcLang}
          />
        ))}
      </video>

      {title && (
        <div className={`custom-player-title ${areControlsVisible ? 'is-visible' : 'is-hidden'}`}>
          <div className="custom-player-title-inner">
            <span className="custom-player-title-primary">{title}</span>
            {subtitle ? <span className="custom-player-title-secondary">{subtitle}</span> : null}
          </div>
        </div>
      )}

      {isUsingParsedSubtitles && activeParsedSubtitleText && (
        <div
          className={`custom-player-ass-subtitles ${
            areControlsVisible ? 'is-with-controls' : ''
          }`}
        >
          <span>{activeParsedSubtitleText}</span>
        </div>
      )}

      {isSettingsOpen && (
        <aside
          ref={settingsPanelRef}
          className="custom-player-settings-panel"
          role="dialog"
          aria-label="Player settings"
        >
          <div className="custom-player-settings-header">
            <p className="custom-player-settings-kicker">Player Settings</p>
          </div>

          <div className="custom-player-settings-tabs" role="tablist" aria-label="Settings categories">
            <button
              type="button"
              className={`custom-player-settings-tab ${
                selectedSettingsTab === 'speed' ? 'is-active' : ''
              }`}
              role="tab"
              aria-selected={selectedSettingsTab === 'speed'}
              aria-controls="player-settings-speed"
              onClick={() => setSelectedSettingsTab('speed')}
            >
              Playback Speed
            </button>

            <button
              type="button"
              className={`custom-player-settings-tab ${
                selectedSettingsTab === 'quality' ? 'is-active' : ''
              }`}
              role="tab"
              aria-selected={selectedSettingsTab === 'quality'}
              aria-controls="player-settings-quality"
              onClick={() => setSelectedSettingsTab('quality')}
            >
              Playback Quality
            </button>
          </div>

          <div
            className="custom-player-settings-section"
            id={`player-settings-${selectedSettingsTab}`}
            role="tabpanel"
          >
            {selectedSettingsTab === 'speed' ? (
              <>
                <span className="custom-player-settings-label">Playback Speed</span>

                <div className="custom-player-settings-list">
                  {PLAYBACK_SPEED_OPTIONS.map((speed) => (
                    <button
                      key={speed}
                      type="button"
                      className={`custom-player-settings-list-item ${
                        playbackRate === speed ? 'is-active' : ''
                      }`}
                      onClick={() => setPlaybackRate(speed)}
                    >
                      <span>{speed}x</span>
                    </button>
                  ))}
                </div>
              </>
            ) : selectedSettingsTab === 'quality' ? (
              <>
                <span className="custom-player-settings-label">Playback Quality</span>

                <div className="custom-player-settings-list">
                  {PLAYBACK_QUALITY_OPTIONS.map((quality) => (
                    <button
                      key={quality}
                      type="button"
                      className={`custom-player-settings-list-item ${
                        selectedQuality === quality ? 'is-active' : ''
                      }`}
                      onClick={() => applyQualitySelection(quality)}
                    >
                      <span>{quality}p</span>
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </aside>
      )}

      {isSubtitlesOpen && (
        <aside
          ref={subtitlesPanelRef}
          className="custom-player-subtitles-panel"
          role="dialog"
          aria-label="Subtitles"
        >
          <div className="custom-player-settings-header">
            <p className="custom-player-settings-kicker">Subtitles</p>
          </div>

          <div className="custom-player-settings-section">
            <span className="custom-player-settings-label">Subtitle Tracks</span>

            <div className="custom-player-settings-list">
              <button
                type="button"
                className={`custom-player-settings-list-item ${
                  selectedSubtitleTrackId === SUBTITLE_OFF_OPTION.id ? 'is-active' : ''
                }`}
                onClick={() => setSelectedSubtitleTrackId(SUBTITLE_OFF_OPTION.id)}
              >
                <span>{SUBTITLE_OFF_OPTION.label}</span>
              </button>

              {subtitleOptions.map((subtitleOption) => (
                <button
                  key={subtitleOption.id}
                  type="button"
                  className={`custom-player-settings-list-item ${
                    selectedSubtitleTrackId === subtitleOption.id ? 'is-active' : ''
                  }`}
                  onClick={() => setSelectedSubtitleTrackId(subtitleOption.id)}
                >
                  <span>{subtitleOption.label}</span>
                </button>
              ))}
            </div>

            {!hasSubtitleTrackSupport && (
              <p className="custom-player-settings-note">
                No subtitles have been added for this title yet.
              </p>
            )}

            {isUsingParsedSubtitles && isParsedSubtitleLoading && !parsedSubtitleLoadError && (
              <p className="custom-player-settings-note">Loading subtitle track...</p>
            )}

            {isUsingParsedSubtitles && parsedSubtitleLoadError && (
              <p className="custom-player-settings-note">{parsedSubtitleLoadError}</p>
            )}
          </div>
        </aside>
      )}

      <div className={`custom-player-controls ${areControlsVisible ? 'is-visible' : 'is-hidden'}`}>
        <div className="custom-player-scrubber-row">
          <span className="custom-player-time">{formatTime(currentTime)}</span>

          <input
            className="custom-player-seek"
            type="range"
            min="0"
            max={Math.max(duration, 0)}
            step="0.1"
            value={Math.min(currentTime, duration || currentTime)}
            onChange={handleSeek}
            aria-label="Seek video"
            style={{ '--range-fill': seekFillPercent }}
          />

          <span className="custom-player-time">{formatTime(duration)}</span>
        </div>

        <div className="custom-player-actions">
          <div className="custom-player-actions-left">
            <button
              type="button"
              className="custom-player-btn custom-player-icon-btn custom-player-primary-btn"
              onClick={togglePlayback}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <PauseIcon /> : <PlayIcon />}
            </button>

            <button
              type="button"
              className="custom-player-btn custom-player-chip-btn"
              onClick={() => skipBy(-10)}
              aria-label="Go back 10 seconds"
            >
              -10
            </button>

            <button
              type="button"
              className="custom-player-btn custom-player-chip-btn"
              onClick={() => skipBy(10)}
              aria-label="Skip ahead 10 seconds"
            >
              +10
            </button>

            <div
              className={`custom-player-volume ${isVolumeExpanded ? 'is-expanded' : 'is-collapsed'}`}
              onMouseEnter={handleVolumeMouseEnter}
              onMouseLeave={handleVolumeMouseLeave}
              onFocusCapture={revealVolumeSlider}
              onBlurCapture={() => scheduleVolumeCollapse()}
            >
              <button
                type="button"
                className="custom-player-volume-trigger"
                aria-label={volume === 0 ? 'Unmute volume' : 'Mute volume'}
                onFocus={revealVolumeSlider}
                onClick={() => {
                  revealVolumeSlider()

                  if (volume === 0) {
                    updateVolume(lastAudibleVolumeRef.current || 1)
                  } else {
                    updateVolume(0)
                  }

                  scheduleVolumeCollapse()
                }}
              >
                <VolumeIcon muted={volume === 0} />
              </button>

              <span className="custom-player-volume-slider-wrap">
                <input
                  className="custom-player-volume-slider"
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volume}
                  onChange={handleVolumeChange}
                  aria-label="Volume"
                  style={{ '--range-fill': volumeFillPercent }}
                />
              </span>
            </div>
          </div>

          <div className="custom-player-actions-right">
            {showEpisodesButton && (
              <button
                type="button"
                className="custom-player-btn custom-player-icon-btn"
                data-player-episodes-toggle="true"
                onClick={() => {
                  if (isSettingsOpen || isSubtitlesOpen || hasBlockingPanelOpen) {
                    if (isSettingsOpen) {
                      setIsSettingsOpen(false)
                    }

                    if (isSubtitlesOpen) {
                      setIsSubtitlesOpen(false)
                    }

                    onDismissBlockingPanels?.()
                    setAreControlsVisible(true)
                    return
                  }

                  onEpisodesClick?.()
                }}
                aria-label="Episodes"
                title="Episodes"
              >
                <EpisodesIcon />
              </button>
            )}

            <button
              ref={subtitlesButtonRef}
              type="button"
              className={`custom-player-btn custom-player-icon-btn ${
                isSubtitlesOpen || areSubtitlesEnabled ? 'is-active' : ''
              }`}
              aria-label="Subtitles"
              aria-expanded={isSubtitlesOpen}
              title="Subtitles"
              onClick={() => {
                if (hasBlockingPanelOpen) {
                  onDismissBlockingPanels?.()
                }

                setIsSettingsOpen(false)
                setIsSubtitlesOpen((current) => !current)
                setAreControlsVisible(true)
              }}
            >
              <SubtitlesIcon />
            </button>

            <button
              ref={settingsButtonRef}
              type="button"
              className={`custom-player-btn custom-player-icon-btn ${isSettingsOpen ? 'is-active' : ''}`}
              aria-label="Settings"
              aria-expanded={isSettingsOpen}
              title="Settings"
              onClick={() => {
                if (hasBlockingPanelOpen) {
                  onDismissBlockingPanels?.()
                }

                setIsSubtitlesOpen(false)
                setIsSettingsOpen((current) => !current)
                setAreControlsVisible(true)
              }}
            >
              <GearIcon />
            </button>

            <button
              type="button"
              className="custom-player-btn custom-player-icon-btn"
              onClick={onToggleFullscreen}
              aria-label={isFullscreen ? 'Exit full screen' : 'Enter full screen'}
              title={isFullscreen ? 'Exit full screen' : 'Enter full screen'}
            >
              <FullscreenIcon active={isFullscreen} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
