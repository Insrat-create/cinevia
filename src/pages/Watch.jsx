import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import BunnyPlayer from '../components/BunnyPlayer'
import RatingInline from '../components/RatingInline'
import movies from '../data/movies'
import tvShows from '../data/tvShows'
import { useAccount } from '../context/AccountContext'
import { getBackgroundImageStyle } from '../utils/media'
import { getRatingValue } from '../utils/rating'

function getRelatedHref(item) {
  return item.seasons ? `/tv-shows/${item.id}` : `/movies/${item.id}`
}

function findEpisodeMatch(contentId) {
  for (const show of tvShows) {
    for (const season of show.seasonsData ?? []) {
      for (const episode of season.episodes ?? []) {
        if (episode.id === contentId) {
          return {
            show,
            season,
            episode,
          }
        }
      }
    }
  }

  return null
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

export default function Watch() {
  const { id } = useParams()
  const location = useLocation()
  const {
    getPlaybackProgress,
    isFavorite,
    saveContinueWatching,
    toggleFavorite,
  } = useAccount()
  const allContent = [...movies, ...tvShows]
  const episodeMatch = findEpisodeMatch(id)
  const nextEpisodeMatch = findNextEpisodeMatch(episodeMatch)
  const movie = buildEpisodeWatchItem(episodeMatch) ?? allContent.find((item) => item.id === id)
  const nextEpisode = buildEpisodeWatchItem(nextEpisodeMatch)
  const parentShow = movie?.parentShow ?? null
  const favoriteTarget = parentShow ?? movie
  const playbackProgress = movie ? getPlaybackProgress(movie.id, movie.progress ?? 0) : 0
  const lastSavedProgressRef = useRef(playbackProgress)
  const lastSavedAtRef = useRef(0)
  const [showNextEpisodePrompt, setShowNextEpisodePrompt] = useState(false)
  const nextEpisodePromptHandledRef = useRef(false)

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
  }, [id])

  const handleProgressChange = (nextProgress) => {
    if (!movie) {
      return
    }

    const normalizedProgress = nextProgress >= 95 ? 100 : nextProgress
    const progressDelta = Math.abs(normalizedProgress - lastSavedProgressRef.current)
    const now = Date.now()
    const hasReachedCompletion = normalizedProgress === 100 && lastSavedProgressRef.current !== 100
    const hasMeaningfulChange = progressDelta >= 2
    const hasWaitedLongEnough = now - lastSavedAtRef.current >= 15000

    if (!hasReachedCompletion && !hasMeaningfulChange && !hasWaitedLongEnough) {
      return
    }

    lastSavedProgressRef.current = normalizedProgress
    lastSavedAtRef.current = now
    void saveContinueWatching(parentShow ?? movie, normalizedProgress, parentShow ? movie.id : null)
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

  if (episodeMatch) {
    return (
      <div className="app-shell">
        <main className="watch-page watch-player-only-page">
          <button
            type="button"
            className="back-link"
            onClick={() => goBackTo(`/tv-shows/${parentShow?.id ?? movie.id}`)}
          >
            Back
          </button>

          <section className="watch-player-only-frame">
            <BunnyPlayer
              videoId={movie.bunnyVideoId}
              title={movie.episodeTitle || movie.title}
              onEnded={openNextEpisodePrompt}
              onNearEnd={openNextEpisodePrompt}
              onProgressChange={handleProgressChange}
            />
          </section>

          {showNextEpisodePrompt && nextEpisode && (
            <aside
              className="watch-next-episode-popup"
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
                  <p>
                    {[parentShow?.title, nextEpisode.seasonLabel].filter(Boolean).join(' • ')}
                  </p>
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
                  to={`/watch/${nextEpisode.id}`}
                  replace
                  state={{ from: `/tv-shows/${parentShow?.id ?? movie.id}` }}
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
        <main className="watch-page watch-player-only-page">
          <button
            type="button"
            className="back-link"
            onClick={() => goBackTo(`/movies/${movie.id}`)}
          >
            Back
          </button>

          <section className="watch-player-only-frame">
            <BunnyPlayer
              videoId={movie.bunnyVideoId}
              title={movie.title}
              onProgressChange={handleProgressChange}
            />
          </section>
        </main>
      </div>
    )
  }

  const isSeries = Boolean(movie.seasons)
  const ratingValue = getRatingValue(movie)
  const tertiaryHref = isSeries ? `/tv-shows/${parentShow?.id ?? movie.id}` : '/favorites'
  const tertiaryLabel = isSeries ? 'Episode Guide' : 'View My List'
  const metaItems = [
    movie.genre ?? movie.badge,
    movie.year,
    movie.maturityRating,
    isSeries ? movie.seasons : movie.duration,
  ].filter(Boolean)

  const detailItems = [
    {
      label: 'Type',
      value: isSeries ? 'TV Series' : 'Movie',
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

  const relatedItems = (isSeries ? tvShows : movies)
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
                onClick={() => goBackTo(isSeries ? `/tv-shows/${parentShow?.id ?? movie.id}` : '/movies')}
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
                <a href="#watch-player" className="watch-primary-btn">
                  Play Now
                </a>

                <button
                  className={`watch-list-btn ${isFavorite(favoriteTarget.id) ? 'active' : ''}`}
                  type="button"
                  onClick={() => toggleFavorite(favoriteTarget)}
                >
                  {isFavorite(favoriteTarget.id) ? 'Remove from My List' : 'Add to My List'}
                </button>

                <Link to={tertiaryHref} className="watch-secondary-btn">
                  {tertiaryLabel}
                </Link>
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

          <section className="watch-player-section" id="watch-player">
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
                videoId={movie.bunnyVideoId}
                title={movie.title}
                onProgressChange={handleProgressChange}
              />
            </div>
          </section>

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
                  <Link to={getRelatedHref(item)} key={item.id} className="watch-related-card">
                    <img src={item.backdrop ?? item.poster} alt={item.title} />
                    <div className="watch-related-overlay" />

                    <div className="watch-related-copy">
                      <p>{[item.year, item.maturityRating].filter(Boolean).join(' / ')}</p>
                      <h3>{item.title}</h3>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  )
}
