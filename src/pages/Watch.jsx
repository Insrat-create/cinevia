import { useEffect, useRef } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
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

export default function Watch() {
  const { id } = useParams()
  const navigate = useNavigate()
  const {
    getPlaybackProgress,
    isFavorite,
    saveContinueWatching,
    toggleFavorite,
  } = useAccount()
  const allContent = [...movies, ...tvShows]
  const episodeMatch = findEpisodeMatch(id)
  const movie = buildEpisodeWatchItem(episodeMatch) ?? allContent.find((item) => item.id === id)
  const parentShow = movie?.parentShow ?? null
  const favoriteTarget = parentShow ?? movie
  const playbackProgress = movie ? getPlaybackProgress(movie.id, movie.progress ?? 0) : 0
  const lastSavedProgressRef = useRef(playbackProgress)
  const lastSavedAtRef = useRef(0)

  const goBackOrFallback = (fallbackPath) => {
    if (window.history.length > 1) {
      navigate(-1)
      return
    }

    navigate(fallbackPath, { replace: true })
  }

  useEffect(() => {
    lastSavedProgressRef.current = playbackProgress
  }, [playbackProgress])

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
            onClick={() => goBackOrFallback(`/tv-shows/${parentShow?.id ?? movie.id}`)}
          >
            Back
          </button>

          <section className="watch-player-only-frame">
            <BunnyPlayer
              videoId={movie.bunnyVideoId}
              title={movie.episodeTitle || movie.title}
              onProgressChange={handleProgressChange}
            />
          </section>
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
            onClick={() => goBackOrFallback(`/movies/${movie.id}`)}
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
                onClick={() => goBackOrFallback(isSeries ? `/tv-shows/${parentShow?.id ?? movie.id}` : '/movies')}
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
