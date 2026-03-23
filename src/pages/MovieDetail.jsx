import { useMemo } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import RatingInline from '../components/RatingInline'
import Sidebar from '../components/Sidebar'
import Topbar from '../components/Topbar'
import movies from '../data/movies'
import { useAccount } from '../context/AccountContext'
import { getBackgroundImageStyle } from '../utils/media'
import { getRatingValue } from '../utils/rating'

function getRelatedMovies(movie) {
  return movies
    .filter((item) => item.id !== movie.id)
    .sort((left, right) => {
      const scoreItem = (item) => {
        let score = 0

        if ((item.genre ?? item.badge) === (movie.genre ?? movie.badge)) {
          score += 3
        }

        if (item.maturityRating === movie.maturityRating) {
          score += 2
        }

        if (item.duration === movie.duration) {
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
}

export default function MovieDetail() {
  const { id } = useParams()
  const location = useLocation()
  const { isFavorite, toggleFavorite } = useAccount()
  const movie = movies.find((item) => item.id === id)
  const relatedMovies = useMemo(() => (movie ? getRelatedMovies(movie) : []), [movie])
  const currentPath = `${location.pathname}${location.search}${location.hash}`

  if (!movie) {
    return (
      <div className="app-shell">
        <Sidebar />
        <main className="watch-page">
          <h2>Movie not found</h2>
          <Link to="/movies">Go back to Movies</Link>
        </main>
      </div>
    )
  }

  const ratingValue = getRatingValue(movie)
  const metaItems = [
    movie.genre ?? movie.badge,
    movie.year,
    movie.maturityRating,
    movie.duration,
  ].filter(Boolean)

  return (
    <div className="app-shell">
      <Sidebar />

      <main className="watch-page tv-show-detail-page movie-detail-page">
        <div
          className="watch-backdrop"
          style={getBackgroundImageStyle(movie.backdrop)}
          aria-hidden="true"
        />
        <div className="watch-page-scrim" />
        <div className="watch-page-glow" aria-hidden="true" />

        <Topbar showSearch={false} />

        <div className="watch-page-inner show-detail-inner">
          <section className="watch-spotlight">
            <div className="watch-copy">
              <h1>{movie.title}</h1>

              <div className="watch-meta-row" aria-label="Movie details">
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
                <Link to={`/watch/${movie.id}`} state={{ from: currentPath }} className="watch-primary-btn">
                  Play Movie
                </Link>

                <button
                  className={`watch-list-btn ${isFavorite(movie.id) ? 'active' : ''}`}
                  type="button"
                  onClick={() => toggleFavorite(movie)}
                >
                  {isFavorite(movie.id) ? 'Remove from My List' : 'Add to My List'}
                </button>
              </div>
            </div>

            <aside className="watch-sidecard">
              <div className="watch-sidecard-media">
                <img src={movie.poster} alt={movie.title} />
                <div className="watch-sidecard-overlay" />
                <span className="watch-sidecard-badge">{movie.maturityRating ?? 'NR'}</span>
              </div>
            </aside>
          </section>

          {relatedMovies.length > 0 && (
            <section className="watch-related-section">
              <div className="watch-section-heading">
                <p className="watch-panel-kicker">Recommended</p>
                <h2>More movies to watch next</h2>
              </div>

              <div className="watch-related-grid">
                {relatedMovies.map((item) => (
                  <Link to={`/movies/${item.id}`} key={item.id} className="watch-related-card">
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
