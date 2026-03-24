import Hls from 'hls.js'
import { useEffect, useRef, useState } from 'react'
import { fetchBunnyPlaybackInfo } from '../utils/bunny'

const VOLUME_COLLAPSE_DELAY_MS = 1
const CONTROLS_HIDE_DELAY_MS = 2500
const PLAYBACK_SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2]
const PLAYBACK_QUALITY_OPTIONS = [360, 720, 1080]

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
  subtitle,
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
  const onEndedRef = useRef(onEnded)
  const onNearEndRef = useRef(onNearEnd)
  const onProgressChangeRef = useRef(onProgressChange)
  const hasTriggeredNearEndRef = useRef(false)
  const uiFrameRef = useRef(null)
  const playbackSnapshotRef = useRef({
    currentTime: 0,
    duration: 0,
    lastProgress: -1,
  })
  const lastAudibleVolumeRef = useRef(1)
  const [playbackInfo, setPlaybackInfo] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [areControlsVisible, setAreControlsVisible] = useState(true)
  const [isVolumeExpanded, setIsVolumeExpanded] = useState(true)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [selectedSettingsTab, setSelectedSettingsTab] = useState('speed')
  const [playbackRate, setPlaybackRate] = useState(1)
  const [selectedQuality, setSelectedQuality] = useState(1080)

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

    if (!isPlaying || isSettingsOpen) {
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
  }, [areControlsVisible, isPlaying, isSettingsOpen])

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
        onProgressChangeRef.current?.(nextProgress)
      }

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

    const handleLoadedData = () => {
      setIsLoading(false)
      playbackSnapshotRef.current.duration = video.duration || 0
      queueUiSync()
    }

    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)

    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('ended', handleEnded)
    video.addEventListener('loadeddata', handleLoadedData)
    video.addEventListener('play', handlePlay)
    video.addEventListener('pause', handlePause)

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
      })

      hlsRef.current = hls
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        applyQualitySelection(selectedQuality, hls)
      })
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
      video.removeEventListener('play', handlePlay)
      video.removeEventListener('pause', handlePause)

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
    if (!isSettingsOpen) {
      return
    }

    const handlePointerDown = (event) => {
      const target = event.target

      if (
        settingsPanelRef.current?.contains(target) ||
        settingsButtonRef.current?.contains(target)
      ) {
        return
      }

      setIsSettingsOpen(false)
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsSettingsOpen(false)
      }
    }

    document.addEventListener('click', handlePointerDown)
    window.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('click', handlePointerDown)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isSettingsOpen])

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

    if (!isPlaying || isSettingsOpen) {
      return
    }

    hideControlsTimeoutRef.current = setTimeout(() => {
      setAreControlsVisible(false)
      hideControlsTimeoutRef.current = null
    }, CONTROLS_HIDE_DELAY_MS)
  }

  const handleSurfaceClick = async () => {
    if (isSettingsOpen || hasBlockingPanelOpen) {
      if (isSettingsOpen) {
        setIsSettingsOpen(false)
      }

      onDismissBlockingPanels?.()
      setAreControlsVisible(true)
      return
    }

    await togglePlayback()
  }

  useEffect(() => {
    const handleKeyDown = (event) => {
      const activeElement = document.activeElement
      const isTypingTarget =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLSelectElement ||
        activeElement?.isContentEditable

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
  }, [volume])

  const seekFillPercent =
    duration > 0 ? `${Math.min(100, Math.max(0, (currentTime / duration) * 100))}%` : '0%'
  const volumeFillPercent = `${Math.min(100, Math.max(0, volume * 100))}%`

  return (
    <div
      className={`bunny-player-wrap ${areControlsVisible ? 'controls-visible' : 'controls-hidden'}`}
      onMouseMove={revealControls}
      onTouchStart={revealControls}
    >
      {isLoading && <div className="custom-player-loading">Loading stream...</div>}

      <video
        ref={videoRef}
        className="bunny-player custom-video-player"
        aria-label={title}
        onClick={handleSurfaceClick}
        playsInline
        preload="metadata"
        poster={playbackInfo?.posterUrl ?? ''}
      />

      {title && (
        <div className={`custom-player-title ${areControlsVisible ? 'is-visible' : 'is-hidden'}`}>
          <div className="custom-player-title-inner">
            <span className="custom-player-title-primary">{title}</span>
            {subtitle ? <span className="custom-player-title-secondary">{subtitle}</span> : null}
          </div>
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
            id={selectedSettingsTab === 'speed' ? 'player-settings-speed' : 'player-settings-quality'}
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
            ) : (
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
                onClick={() => {
                  if (isSettingsOpen || hasBlockingPanelOpen) {
                    if (isSettingsOpen) {
                      setIsSettingsOpen(false)
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
              type="button"
              className="custom-player-btn custom-player-icon-btn"
              aria-label="Subtitles"
              title="Subtitles"
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
                if (hasBlockingPanelOpen && !isSettingsOpen) {
                  onDismissBlockingPanels?.()
                  setAreControlsVisible(true)
                  return
                }

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
