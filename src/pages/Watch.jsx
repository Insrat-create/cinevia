import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useParams } from 'react-router-dom'
import BunnyPlayer from '../components/BunnyPlayer'
import MediaCardLink from '../components/MediaCardLink'
import RatingInline from '../components/RatingInline'
import ThumbnailRow from '../components/ThumbnailRow'
import anime from '../data/anime'
import movies from '../data/movies'
import tvShows from '../data/tvShows'
import { useAccount } from '../context/AccountContext'
import { fetchBunnyThumbnailUrl } from '../utils/bunny'
import { getCatalogType, getDetailPath } from '../utils/catalogPaths'
import { findEpisodeMatchInCollections } from '../utils/episodeMatch'
import { getBackgroundImageStyle } from '../utils/media'
import { getRatingValue } from '../utils/rating'

function getRelatedHref(item) {
  return getDetailPath(item)
}

function buildEpisodeWatchItem(match) {
  if (!match) {
    return null
  }

  const { show, season, episode } = match

  return {
    ...show,
    id: episode.id,
    bunnyVideoId: episode.bunnyVideoId || show.bunnyVideoId,
    episodeTitle: episode.episodeTitle || episode.title,
    parentShow: show,
    parentShowId: show.id,
    poster: episode.poster || show.poster,
    progress: episode.progress ?? show.progress ?? 0,
    released: episode.released || show.released,
    seasonLabel: season?.label || '',
    subtitleTracks: episode.subtitleTracks ?? show.subtitleTracks ?? [],
  }
}

function findNextEpisodeMatch(match) {
  if (!match?.show?.seasonsData?.length || !match.season || !match.episode) {
    return null
  }

  const seasons = match.show.seasonsData
  const seasonIndex = seasons.findIndex((season) => season.id === match.season.id)

  if (seasonIndex === -1) {
    return null
  }

  const episodeIndex = seasons[seasonIndex].episodes.findIndex(
    (episode) => episode.id === match.episode.id
  )

  if (episodeIndex === -1) {
    return null
  }

  const currentSeasonEpisodes = seasons[seasonIndex].episodes
  const nextEpisodeInSeason = currentSeasonEpisodes[episodeIndex + 1]

  if (nextEpisodeInSeason) {
    return {
      show: match.show,
      season: seasons[seasonIndex],
      episode: nextEpisodeInSeason,
    }
  }

  for (let nextSeasonIndex = seasonIndex + 1; nextSeasonIndex < seasons.length; nextSeasonIndex += 1) {
    const nextSeason = seasons[nextSeasonIndex]
    const firstEpisode = nextSeason?.episodes?.[0]

    if (firstEpisode) {
      return {
        show: match.show,
        season: nextSeason,
        episode: firstEpisode,
      }
    }
  }

  return null
}

function buildEpisodePlayerSubtitle(seasonLabel, episodeTitle, fallbackTitle) {
  const seasonMatch = seasonLabel?.match(/(\d+)/)
  const episodeMatch = episodeTitle?.match(/Episode\s+(\d+):?\s*(.*)/i)
  const seasonPart = seasonMatch ? `S${seasonMatch[1]}` : seasonLabel
  const episodePart = episodeMatch ? `E${episodeMatch[1]}` : null
  const titlePart = (episodeMatch?.[2] || fallbackTitle || episodeTitle || '').trim()

  return [seasonPart, episodePart, titlePart].filter(Boolean).join(' • ')
}

function getAnimeAudioMode(search) {
  const requestedMode = new URLSearchParams(search).get('audio')

  if (requestedMode === 'dub') {
    return 'dub'
  }

  if (requestedMode === 'sub') {
    return 'sub'
  }

  return null
}

function appendSearchToPath(pathname, search) {
  return search ? `${pathname}${search}` : pathname
}

function getPlayerViewportStyle() {
  if (typeof window === 'undefined') {
    return {}
  }

  const visualViewport = window.visualViewport
  const visibleTop = Math.max(0, Math.round(visualViewport?.offsetTop ?? 0))
  const visibleLeft = Math.max(0, Math.round(visualViewport?.offsetLeft ?? 0))
  const visibleWidth = Math.max(0, Math.round(visualViewport?.width ?? window.innerWidth))
  const visibleHeight = Math.max(0, Math.round(visualViewport?.height ?? window.innerHeight))
  const visibleRight = Math.max(0, Math.round(window.innerWidth - (visibleLeft + visibleWidth)))
  const visibleBottom = Math.max(0, Math.round(window.innerHeight - (visibleTop + visibleHeight)))

  return {
    '--player-visible-bottom': `${visibleBottom}px`,
    '--player-visible-height': `${visibleHeight}px`,
    '--player-visible-left': `${visibleLeft}px`,
    '--player-visible-right': `${visibleRight}px`,
    '--player-visible-top': `${visibleTop}px`,
    '--player-visible-width': `${visibleWidth}px`,
  }
}

export default function Watch() {
  const { id } = useParams()
  const location = useLocation()
  const {
    continueWatchingItems,
    getPlaybackProgress,
    getPlaybackResumeTime,
    isAnimeAccessAllowed,
    isFavorite,
    isInContinueWatching,
    removeContinueWatching,
    saveContinueWatching,
    toggleFavorite,
  } = useAccount()
  const allContent = [...movies, ...tvShows, ...anime]
  const episodeMatch = findEpisodeMatchInCollections([tvShows, anime], id)
  const nextEpisodeMatch = findNextEpisodeMatch(episodeMatch)
  const movie = buildEpisodeWatchItem(episodeMatch) ?? allContent.find((item) => item.id === id)
  const nextEpisode = buildEpisodeWatchItem(nextEpisodeMatch)
  const parentShow = movie?.parentShow ?? null
  const catalogType = movie ? getCatalogType(parentShow ?? movie) : null
  const animeAudioMode = catalogType === 'anime' ? getAnimeAudioMode(location.search) ?? 'sub' : null
  const animeAudioSearch = animeAudioMode ? `?audio=${animeAudioMode}` : ''
  const preferredAudioLanguage =
    animeAudioMode === 'sub' ? 'ja' : animeAudioMode === 'dub' ? 'en' : null
  const preferredSubtitleMode =
    animeAudioMode === 'sub' ? 'on' : animeAudioMode === 'dub' ? 'off' : null
  const pickerSeasons = parentShow?.seasonsData ?? []
  const playerShellRef = useRef(null)
  const playerVideoRef = useRef(null)
  const pickerTabsRef = useRef(null)
  const seasonTabsDragRef = useRef({
    isDragging: false,
    startX: 0,
    startScrollLeft: 0,
    shouldCancelClick: false,
  })
  const favoriteTarget = parentShow ?? movie
  const continueWatchingTarget = parentShow ?? movie
  const playbackProgress = movie ? getPlaybackProgress(movie.id, movie.progress ?? 0) : 0
  const playbackResumeTime = movie ? getPlaybackResumeTime(movie.id, 0) : 0
  const lastSavedProgressRef = useRef(playbackProgress)
  const lastSavedAtRef = useRef(0)
  const nextEpisodePromptHandledRef = useRef(false)
  const episodePickerRef = useRef(null)
  const [showNextEpisodePrompt, setShowNextEpisodePrompt] = useState(false)
  const [isEpisodePickerOpen, setIsEpisodePickerOpen] = useState(false)
  const [activePickerSeasonId, setActivePickerSeasonId] = useState(episodeMatch?.season?.id ?? '')
  const [episodeThumbnailUrls, setEpisodeThumbnailUrls] = useState({})
  const [detailShouldAutoplay, setDetailShouldAutoplay] = useState(false)
  const [isPlayerFullscreen, setIsPlayerFullscreen] = useState(false)
  const [isPlayerUiVisible, setIsPlayerUiVisible] = useState(true)
  const [isSeasonTabsDragging, setIsSeasonTabsDragging] = useState(false)
  const [playerViewportStyle, setPlayerViewportStyle] = useState(() => getPlayerViewportStyle())
  const detailPlayerSectionRef = useRef(null)
  const activePickerSeason =
    pickerSeasons.find((season) => season.id === activePickerSeasonId) ??
    pickerSeasons.find((season) => season.id === episodeMatch?.season?.id) ??
    pickerSeasons[0]
  const detailPath = parentShow
    ? appendSearchToPath(getDetailPath(parentShow), animeAudioSearch)
    : movie
      ? appendSearchToPath(getDetailPath(movie), animeAudioSearch)
      : '/'
  const shouldAutoplay = location.state?.autoplay !== false
  const episodePlayerSubtitle = episodeMatch
    ? buildEpisodePlayerSubtitle(
        episodeMatch.season?.label,
        movie?.episodeTitle || movie?.title,
        movie?.title
      )
    : ''

  const goBackTo = (fallbackPath) => {
    const sourcePath =
      typeof location.state?.from === 'string' && location.state.from !== location.pathname
        ? location.state.from
        : fallbackPath

    window.location.replace(sourcePath)
  }

  const openNextEpisodePrompt = () => {
    if (!nextEpisode || nextEpisodePromptHandledRef.current) {
      return
    }

    nextEpisodePromptHandledRef.current = true
    setShowNextEpisodePrompt(true)
  }

  useEffect(() => {
    lastSavedProgressRef.current = playbackProgress
  }, [playbackProgress])

  useEffect(() => {
    nextEpisodePromptHandledRef.current = false
    setShowNextEpisodePrompt(false)
    setIsEpisodePickerOpen(false)
    setActivePickerSeasonId(episodeMatch?.season?.id ?? pickerSeasons[0]?.id ?? '')
    setDetailShouldAutoplay(false)
  }, [episodeMatch?.season?.id, id, pickerSeasons])

  useEffect(() => {
    if (!episodeMatch || !isEpisodePickerOpen || !activePickerSeason) {
      return undefined
    }

    let isCancelled = false

    const hydrateEpisodeThumbnails = async () => {
      const episodes = (activePickerSeason.episodes ?? []).filter(
        (episode) => episode.bunnyVideoId && !episodeThumbnailUrls[episode.id]
      )

      if (episodes.length === 0) {
        return
      }

      const nextEntries = {}

      for (const episode of episodes) {
        const thumbnailUrl = await fetchBunnyThumbnailUrl(episode.bunnyVideoId)

        if (isCancelled) {
          return
        }

        if (thumbnailUrl) {
          nextEntries[episode.id] = thumbnailUrl
        }
      }

      if (Object.keys(nextEntries).length === 0 || isCancelled) {
        return
      }

      setEpisodeThumbnailUrls((current) => ({
        ...current,
        ...nextEntries,
      }))
    }

    void hydrateEpisodeThumbnails()

    return () => {
      isCancelled = true
    }
  }, [activePickerSeason, episodeMatch, episodeThumbnailUrls, isEpisodePickerOpen])

  useEffect(() => {
    if (!isEpisodePickerOpen) {
      return undefined
    }

    const handleOutsideClick = (event) => {
      const target = event.target

      if (
        episodePickerRef.current?.contains(target) ||
        target?.closest?.('[data-player-episodes-toggle="true"]')
      ) {
        return
      }

      setIsEpisodePickerOpen(false)
    }

    document.addEventListener('click', handleOutsideClick)

    return () => {
      document.removeEventListener('click', handleOutsideClick)
    }
  }, [isEpisodePickerOpen])

  useEffect(() => {
    const handleFullscreenChange = () => {
      const webkitFullscreenElement = document.webkitFullscreenElement
      const activeFullscreenElement = document.fullscreenElement || webkitFullscreenElement
      const isVideoFullscreen =
        playerVideoRef.current &&
        (activeFullscreenElement === playerVideoRef.current ||
          document.webkitFullscreenElement === playerVideoRef.current)

      setIsPlayerFullscreen(
        activeFullscreenElement === playerShellRef.current || Boolean(isVideoFullscreen)
      )
    }

    handleFullscreenChange()
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange)

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    let animationFrameId = null

    const syncPlayerViewport = () => {
      animationFrameId = null
      const nextViewportStyle = getPlayerViewportStyle()

      setPlayerViewportStyle((currentViewportStyle) => {
        const nextEntries = Object.entries(nextViewportStyle)

        if (
          nextEntries.length === Object.keys(currentViewportStyle).length &&
          nextEntries.every(([key, value]) => currentViewportStyle[key] === value)
        ) {
          return currentViewportStyle
        }

        return nextViewportStyle
      })
    }

    const queueViewportSync = () => {
      if (animationFrameId !== null) {
        return
      }

      animationFrameId = window.requestAnimationFrame(syncPlayerViewport)
    }

    const visualViewport = window.visualViewport

    queueViewportSync()
    window.addEventListener('resize', queueViewportSync)
    window.addEventListener('orientationchange', queueViewportSync)
    visualViewport?.addEventListener('resize', queueViewportSync)
    visualViewport?.addEventListener('scroll', queueViewportSync)

    return () => {
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId)
      }

      window.removeEventListener('resize', queueViewportSync)
      window.removeEventListener('orientationchange', queueViewportSync)
      visualViewport?.removeEventListener('resize', queueViewportSync)
      visualViewport?.removeEventListener('scroll', queueViewportSync)
    }
  }, [])

  const setPlayerVideoNode = (node) => {
    if (playerVideoRef.current === node) {
      return
    }

    if (playerVideoRef.current) {
      playerVideoRef.current.removeEventListener('webkitbeginfullscreen', handleVideoBeginFullscreen)
      playerVideoRef.current.removeEventListener('webkitendfullscreen', handleVideoEndFullscreen)
    }

    playerVideoRef.current = node

    if (playerVideoRef.current) {
      playerVideoRef.current.addEventListener('webkitbeginfullscreen', handleVideoBeginFullscreen)
      playerVideoRef.current.addEventListener('webkitendfullscreen', handleVideoEndFullscreen)
    }
  }

  function handleVideoBeginFullscreen() {
    setIsPlayerFullscreen(true)
  }

  function handleVideoEndFullscreen() {
    setIsPlayerFullscreen(false)
  }

  useEffect(() => {
    return () => {
      if (playerVideoRef.current) {
        playerVideoRef.current.removeEventListener('webkitbeginfullscreen', handleVideoBeginFullscreen)
        playerVideoRef.current.removeEventListener('webkitendfullscreen', handleVideoEndFullscreen)
      }
    }
  }, [])

  useEffect(() => {
    const handleMouseMove = (event) => {
      const rail = pickerTabsRef.current
      const dragState = seasonTabsDragRef.current

      if (!rail || !dragState.isDragging) {
        return
      }

      const deltaX = event.clientX - dragState.startX

      if (Math.abs(deltaX) > 6) {
        dragState.shouldCancelClick = true
      }

      rail.scrollLeft = dragState.startScrollLeft - deltaX

      if (dragState.shouldCancelClick) {
        event.preventDefault()
      }
    }

    const handleMouseUp = () => {
      if (!seasonTabsDragRef.current.isDragging) {
        return
      }

      seasonTabsDragRef.current = {
        ...seasonTabsDragRef.current,
        isDragging: false,
      }
      setIsSeasonTabsDragging(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  const togglePlayerFullscreen = async () => {
    try {
      const fullscreenTarget = document.fullscreenElement || document.webkitFullscreenElement

      if (fullscreenTarget) {
        if (document.exitFullscreen) {
          await document.exitFullscreen()
          return
        }

        if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen()
          return
        }
      }

      if (playerShellRef.current?.requestFullscreen) {
        await playerShellRef.current.requestFullscreen()
        return
      }

      if (playerShellRef.current?.webkitRequestFullscreen) {
        playerShellRef.current.webkitRequestFullscreen()
        return
      }

      if (playerVideoRef.current?.webkitEnterFullscreen) {
        setIsPlayerFullscreen(true)
        playerVideoRef.current.webkitEnterFullscreen()
      }
    } catch {
      // Ignore fullscreen API failures.
    }
  }

  const handleProgressChange = (nextPlaybackState) => {
    if (!movie) {
      return
    }

    const isForcedSave =
      typeof nextPlaybackState === 'number' ? false : Boolean(nextPlaybackState?.force)
    const nextProgress =
      typeof nextPlaybackState === 'number'
        ? nextPlaybackState
        : Number(nextPlaybackState?.progress ?? 0)
    const normalizedProgress = nextProgress >= 95 ? 100 : nextProgress
    const nextResumeTimeSeconds =
      normalizedProgress === 100
        ? 0
        : typeof nextPlaybackState === 'number'
          ? 0
          : Number(nextPlaybackState?.currentTime ?? 0)
    const nextDurationSeconds =
      typeof nextPlaybackState === 'number' ? 0 : Number(nextPlaybackState?.duration ?? 0)
    const progressDelta = Math.abs(normalizedProgress - lastSavedProgressRef.current)
    const now = Date.now()
    const hasReachedCompletion = normalizedProgress === 100 && lastSavedProgressRef.current !== 100
    const hasMeaningfulChange = progressDelta >= 2
    const hasWaitedLongEnough = now - lastSavedAtRef.current >= 15000
    const hasResumeSnapshot = nextResumeTimeSeconds > 0 || normalizedProgress === 100

    if (
      !isForcedSave &&
      !hasReachedCompletion &&
      !hasMeaningfulChange &&
      !hasWaitedLongEnough
    ) {
      return
    }

    if (isForcedSave && !hasResumeSnapshot && normalizedProgress <= 0) {
      return
    }

    lastSavedProgressRef.current = normalizedProgress
    lastSavedAtRef.current = now
    void saveContinueWatching(
      parentShow ?? movie,
      normalizedProgress,
      parentShow ? movie.id : null,
      nextResumeTimeSeconds,
      nextDurationSeconds
    )
  }

  const handleSeasonTabsMouseDown = (event) => {
    if (event.button !== 0) {
      return
    }

    const rail = pickerTabsRef.current

    if (!rail) {
      return
    }

    seasonTabsDragRef.current = {
      isDragging: true,
      startX: event.clientX,
      startScrollLeft: rail.scrollLeft,
      shouldCancelClick: false,
    }
    setIsSeasonTabsDragging(true)
  }

  const handleSeasonTabsClickCapture = (event) => {
    if (!seasonTabsDragRef.current.shouldCancelClick) {
      return
    }

    seasonTabsDragRef.current.shouldCancelClick = false
    event.preventDefault()
    event.stopPropagation()
  }

  const handleDetailPlayNow = (event) => {
    event.preventDefault()
    setDetailShouldAutoplay(true)
    detailPlayerSectionRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })

    const playAttempt = playerVideoRef.current?.play?.()

    if (playAttempt?.catch) {
      playAttempt.catch(() => {
        // Let the player retry once the stream is ready.
      })
    }
  }

  if (!movie) {
    return (
      <div className="app-shell">
        <main className="watch-page">
          <div className="watch-page-scrim" />

          <div className="watch-page-inner">
            <section className="watch-empty-state">
              <p className="watch-panel-kicker">Unavailable</p>
              <h1>That title could not be found.</h1>
              <p>It may have been removed, renamed, or is not ready to stream yet.</p>
              <Link to="/" className="watch-primary-btn">
                Back Home
              </Link>
            </section>
          </div>
        </main>
      </div>
    )
  }

  if (catalogType === 'anime' && !isAnimeAccessAllowed) {
    return <Navigate to="/" replace />
  }

  if (episodeMatch) {
    return (
      <div className="app-shell">
        <main
          ref={playerShellRef}
          className="watch-page watch-player-only-page"
          style={playerViewportStyle}
        >
          <button
            type="button"
            className={`back-link ${isPlayerUiVisible ? 'is-visible' : 'is-hidden'}`}
            onClick={() => goBackTo(detailPath)}
          >
            Back
          </button>

          <section className="watch-player-only-frame">
            <BunnyPlayer
              initialResumeTime={playbackResumeTime}
              videoId={movie.bunnyVideoId}
              hasBlockingPanelOpen={isEpisodePickerOpen}
              preferredAudioLanguage={preferredAudioLanguage}
              preferredSubtitleMode={preferredSubtitleMode}
              title={parentShow?.title || movie.title}
              subtitle={episodePlayerSubtitle}
              subtitleTracks={movie.subtitleTracks}
              onDismissBlockingPanels={() => setIsEpisodePickerOpen(false)}
              onEnded={openNextEpisodePrompt}
              onEpisodesClick={() => setIsEpisodePickerOpen((current) => !current)}
              onNearEnd={openNextEpisodePrompt}
              onProgressChange={handleProgressChange}
              onControlsVisibilityChange={setIsPlayerUiVisible}
              onToggleFullscreen={togglePlayerFullscreen}
              onVideoRefReady={setPlayerVideoNode}
              isFullscreen={isPlayerFullscreen}
              shouldAutoplay={shouldAutoplay}
              showEpisodesButton
            />
          </section>

          {isEpisodePickerOpen && activePickerSeason && (
            <aside
              ref={episodePickerRef}
              id="watch-episode-picker"
              className="watch-episode-picker"
              role="dialog"
              aria-label="Episodes"
            >
              <div className="watch-episode-picker-header">
                <div>
                  <p className="watch-next-episode-kicker">Episodes</p>
                  <h2>{parentShow?.title}</h2>
                </div>

                <button
                  type="button"
                  className="watch-episode-picker-close"
                  onClick={() => setIsEpisodePickerOpen(false)}
                  aria-label="Close episodes"
                >
                  Close
                </button>
              </div>

              <div
                ref={pickerTabsRef}
                className={`watch-episode-picker-tabs ${isSeasonTabsDragging ? 'is-dragging' : ''}`}
                role="tablist"
                aria-label="Seasons"
                onMouseDown={handleSeasonTabsMouseDown}
                onClickCapture={handleSeasonTabsClickCapture}
              >
                {pickerSeasons.map((season) => (
                  <button
                    key={season.id}
                    type="button"
                    className={`watch-episode-picker-tab ${season.id === activePickerSeason?.id ? 'active' : ''}`}
                    onClick={() => setActivePickerSeasonId(season.id)}
                  >
                    {season.label}
                  </button>
                ))}
              </div>

              <div className="watch-episode-picker-list">
                {(activePickerSeason.episodes ?? []).map((episode) => {
                  const isActiveEpisode = episode.id === movie.id

                  return (
                    <Link
                      key={episode.id}
                      to={`/watch/${episode.id}${animeAudioSearch}`}
                      replace
                      state={{ from: detailPath }}
                      className={`watch-episode-picker-item ${isActiveEpisode ? 'active' : ''}`}
                    >
                      <div className="watch-episode-picker-item-thumb">
                        <img
                          src={
                            episodeThumbnailUrls[episode.id] ||
                            episode.poster ||
                            episode.backdrop ||
                            parentShow?.poster
                          }
                          alt={episode.episodeTitle || episode.title}
                        />
                      </div>

                      <div className="watch-episode-picker-item-main">
                        <div className="watch-episode-picker-item-copy">
                          {isActiveEpisode && (
                            <span className="watch-episode-picker-item-current">Now Playing</span>
                          )}

                          <span className="watch-episode-picker-item-title">
                            {episode.episodeTitle || episode.title}
                          </span>
                          <span className="watch-episode-picker-item-meta">{activePickerSeason.label}</span>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </aside>
          )}

          {showNextEpisodePrompt && nextEpisode && (
            <aside
              className={`watch-next-episode-popup ${
                isPlayerUiVisible ? 'is-with-controls' : 'is-without-controls'
              }`}
              role="dialog"
              aria-live="polite"
              aria-label="Next episode ready"
            >
              <p className="watch-next-episode-kicker">Up Next</p>

              <div className="watch-next-episode-body">
                <div className="watch-next-episode-thumb">
                  <img
                    src={nextEpisode.poster ?? nextEpisode.backdrop ?? parentShow?.poster}
                    alt={nextEpisode.episodeTitle || nextEpisode.title}
                  />
                </div>

                <div className="watch-next-episode-copy">
                  <h2>{nextEpisode.episodeTitle || nextEpisode.title}</h2>
                  <p>{[parentShow?.title, nextEpisode.seasonLabel].filter(Boolean).join(' / ')}</p>
                </div>
              </div>

              <div className="watch-next-episode-actions">
                <button
                  type="button"
                  className="watch-next-episode-dismiss"
                  onClick={() => setShowNextEpisodePrompt(false)}
                >
                  Not Now
                </button>

                <Link
                  to={`/watch/${nextEpisode.id}${animeAudioSearch}`}
                  replace
                  state={{ autoplay: true, from: detailPath }}
                  className="watch-next-episode-play"
                >
                  Play Next
                </Link>
              </div>
            </aside>
          )}
        </main>
      </div>
    )
  }

  if (!movie.seasons) {
    return (
      <div className="app-shell">
        <main
          ref={playerShellRef}
          className="watch-page watch-player-only-page"
          style={playerViewportStyle}
        >
          <button
            type="button"
            className={`back-link ${isPlayerUiVisible ? 'is-visible' : 'is-hidden'}`}
            onClick={() => goBackTo(`/movies/${movie.id}`)}
          >
            Back
          </button>

          <section className="watch-player-only-frame">
            <BunnyPlayer
              initialResumeTime={playbackResumeTime}
              videoId={movie.bunnyVideoId}
              preferredAudioLanguage={preferredAudioLanguage}
              preferredSubtitleMode={preferredSubtitleMode}
              shouldAutoplay={shouldAutoplay}
              title={movie.title}
              subtitle=""
              subtitleTracks={movie.subtitleTracks}
              onProgressChange={handleProgressChange}
              onControlsVisibilityChange={setIsPlayerUiVisible}
              onToggleFullscreen={togglePlayerFullscreen}
              onVideoRefReady={setPlayerVideoNode}
              isFullscreen={isPlayerFullscreen}
            />
          </section>
        </main>
      </div>
    )
  }

  const isSeries = Boolean(movie.seasons)
  const isSeriesOverview = isSeries && !episodeMatch
  const ratingValue = getRatingValue(movie)
  const seriesCatalogType = catalogType
  const tertiaryHref = '/favorites'
  const allSeriesEpisodes = isSeries
    ? pickerSeasons.flatMap((season) =>
        (season.episodes ?? []).map((episode) => ({
          ...episode,
          seasonLabel: season.label,
        }))
      )
    : []
  const seriesContinueEntry = isSeriesOverview
    ? continueWatchingItems.find((item) => item.parentShowId === movie.id)
    : null
  const seriesDefaultEpisode = seriesContinueEntry ?? allSeriesEpisodes[0] ?? null
  const seriesPlayHref = seriesDefaultEpisode
    ? `/watch/${seriesDefaultEpisode.id}${animeAudioSearch}`
    : ''
  const seriesPlayLabel = seriesContinueEntry ? 'Continue Watching' : 'Play First Episode'
  const metaItems = [
    movie.genre ?? movie.badge,
    movie.year,
    movie.maturityRating,
    isSeries ? movie.seasons : movie.duration,
  ].filter(Boolean)

  const detailItems = [
    {
      label: 'Type',
      value: isSeries ? (seriesCatalogType === 'anime' ? 'Anime Series' : 'TV Series') : 'Movie',
    },
    {
      label: 'Genre',
      value: movie.genre ?? movie.badge ?? 'Feature',
    },
    {
      label: 'Released',
      value: movie.year ?? 'TBA',
    },
    {
      label: 'Maturity',
      value: movie.maturityRating ?? 'NR',
    },
    {
      label: isSeries ? 'Seasons' : 'Runtime',
      value: isSeries ? movie.seasons : movie.duration ?? 'Unknown',
    },
    {
      label: 'Rating',
      value: ratingValue || 'N/A',
      isRating: true,
    },
  ]

  if (isSeries && movie.episodeTitle) {
    detailItems.push({
      label: 'Current Episode',
      value: movie.episodeTitle,
    })
  }

  if (movie.seasonLabel) {
    detailItems.push({
      label: 'Season',
      value: movie.seasonLabel,
    })
  }

  const relatedItems = (
    isSeries ? (seriesCatalogType === 'anime' ? anime : tvShows) : movies
  )
    .filter((item) => item.id !== (parentShow?.id ?? movie.id))
    .sort((left, right) => {
      const scoreItem = (item) => {
        let score = 0

        if ((item.genre ?? item.badge) === (movie.genre ?? movie.badge)) {
          score += 3
        }

        if (item.maturityRating === movie.maturityRating) {
          score += 2
        }

        if (item.seasons === movie.seasons || item.duration === movie.duration) {
          score += 1
        }

        return score
      }

      const scoreDifference = scoreItem(right) - scoreItem(left)

      if (scoreDifference !== 0) {
        return scoreDifference
      }

      return Number(right.year ?? 0) - Number(left.year ?? 0)
    })
    .slice(0, 4)
  const canRemoveFromContinueWatching = isInContinueWatching(continueWatchingTarget)

  return (
    <div className="app-shell">
      <main className="watch-page">
        <div
          className="watch-backdrop"
          style={getBackgroundImageStyle(movie.backdrop)}
          aria-hidden="true"
        />
        <div className="watch-page-scrim" />
        <div className="watch-page-glow" aria-hidden="true" />

        <div className="watch-page-inner">
          <section className="watch-spotlight">
            <div className="watch-copy">
              <button
                type="button"
                className="back-link"
                onClick={() =>
                  goBackTo(
                    isSeries
                      ? appendSearchToPath(getDetailPath(parentShow ?? movie), animeAudioSearch)
                      : '/movies'
                  )
                }
              >
                Back
              </button>

              <h1>{movie.title}</h1>

              <div className="watch-meta-row" aria-label="Title details">
                {ratingValue && (
                  <span className="watch-meta-pill">
                    <RatingInline source={movie} prefix="Rating" />
                  </span>
                )}

                {metaItems.map((metaItem) => (
                  <span key={`${movie.id}-${metaItem}`} className="watch-meta-pill">
                    {metaItem}
                  </span>
                ))}
              </div>

              <p className="watch-description">{movie.description}</p>

              <div className="watch-hero-actions">
                {isSeriesOverview && seriesPlayHref ? (
                  <Link
                    to={seriesPlayHref}
                    state={{ autoplay: true, from: detailPath }}
                    className="watch-primary-btn"
                  >
                    {seriesPlayLabel}
                  </Link>
                ) : (
                  <a
                    href="#watch-player"
                    className="watch-primary-btn"
                    onClick={handleDetailPlayNow}
                  >
                    Play Now
                  </a>
                )}

                {canRemoveFromContinueWatching && (
                  <button
                    type="button"
                    className="watch-secondary-btn"
                    onClick={() => removeContinueWatching(continueWatchingTarget)}
                  >
                    Remove from Continue Watching
                  </button>
                )}

                <button
                  className={`watch-list-btn ${isFavorite(favoriteTarget.id) ? 'active' : ''}`}
                  type="button"
                  onClick={() => toggleFavorite(favoriteTarget)}
                >
                  {isFavorite(favoriteTarget.id) ? 'Remove from My List' : 'Add to My List'}
                </button>

                {!isSeries && (
                  <Link to={tertiaryHref} className="watch-secondary-btn">
                    View My List
                  </Link>
                )}
              </div>
            </div>

            <aside className="watch-sidecard">
              <div className="watch-sidecard-media">
                <img src={movie.poster} alt={movie.title} />
                <div className="watch-sidecard-overlay" />
                <span className="watch-sidecard-badge">{movie.maturityRating ?? 'NR'}</span>
              </div>

              {isSeries && movie.episodeTitle && (
                <div className="watch-sidecard-content">
                  <p className="watch-sidecard-episode">{movie.episodeTitle}</p>
                </div>
              )}
            </aside>
          </section>

          {isSeriesOverview ? (
            <section className="show-guide-shell" id="episode-guide">
              <div className="watch-section-heading">
                <h2>{activePickerSeason?.label ?? 'Episodes'}</h2>
              </div>

              <ThumbnailRow
                embedded
                movies={activePickerSeason?.episodes ?? []}
                tabs={pickerSeasons.map((season) => ({ id: season.id, label: season.label }))}
                activeTab={activePickerSeason?.id}
                onTabChange={setActivePickerSeasonId}
                getItemHref={(episode) => `/watch/${episode.id}${animeAudioSearch}`}
              />
            </section>
          ) : (
            <section ref={detailPlayerSectionRef} className="watch-player-section" id="watch-player">
              <div className="watch-player-frame">
                <div className="watch-player-chrome">
                  <div>
                    <p className="watch-player-kicker">Watch</p>
                    <h2>{movie.title}</h2>
                  </div>

                  <div className="watch-player-meta">
                    {movie.episodeTitle && <span>{movie.episodeTitle}</span>}
                  </div>
                </div>

                <BunnyPlayer
                  initialResumeTime={playbackResumeTime}
                  videoId={movie.bunnyVideoId}
                  preferredAudioLanguage={preferredAudioLanguage}
                  preferredSubtitleMode={preferredSubtitleMode}
                  shouldAutoplay={detailShouldAutoplay}
                  title={movie.title}
                  subtitleTracks={movie.subtitleTracks}
                  onProgressChange={handleProgressChange}
                  onVideoRefReady={setPlayerVideoNode}
                />
              </div>
            </section>
          )}

          <section className="watch-info-grid">
            <article className="watch-panel">
              <p className="watch-panel-kicker">Overview</p>
              <h3>About this title</h3>
              <p className="watch-panel-text">{movie.description}</p>
            </article>

            <article className="watch-panel">
              <p className="watch-panel-kicker">Details</p>
              <h3>Quick facts</h3>

              <dl className="watch-fact-grid">
                {detailItems.map((detail) => (
                  <div key={`${movie.id}-${detail.label}`} className="watch-fact-item">
                    <dt>{detail.label}</dt>
                    <dd>{detail.isRating && ratingValue ? <RatingInline source={movie} /> : detail.value}</dd>
                  </div>
                ))}
              </dl>
            </article>
          </section>

          {relatedItems.length > 0 && (
            <section className="watch-related-section">
              <div className="watch-section-heading">
                <p className="watch-panel-kicker">Up Next</p>
                <h2>{isSeries ? 'More series to binge' : 'More movies like this'}</h2>
              </div>

              <div className="watch-related-grid">
                {relatedItems.map((item) => (
                  <MediaCardLink
                    item={item}
                    to={getRelatedHref(item)}
                    key={item.id}
                    className="watch-related-card"
                  >
                    <img src={item.backdrop ?? item.poster} alt={item.title} />
                    <div className="watch-related-overlay" />

                    <div className="watch-related-copy">
                      <p>{[item.year, item.maturityRating].filter(Boolean).join(' / ')}</p>
                      <h3>{item.title}</h3>
                    </div>
                  </MediaCardLink>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  )
}
