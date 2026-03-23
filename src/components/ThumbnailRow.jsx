import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAccount } from '../context/AccountContext'
import { fetchBunnyThumbnailUrl } from '../utils/bunny'

export default function ThumbnailRow({
  movies = [],
  tabs = [],
  activeTab,
  onTabChange,
  embedded = false,
  getItemHref = (movie) => `/watch/${movie.id}`,
}) {
  const [thumbnailUrls, setThumbnailUrls] = useState({})
  const { getPlaybackProgress } = useAccount()

  useEffect(() => {
    let isCancelled = false

    const hydrateEpisodeThumbnails = async () => {
      const thumbnailEntries = await Promise.all(
        movies.map(async (movie) => {
          if (!movie.bunnyVideoId) {
            return [movie.id, '']
          }

          const thumbnailUrl = await fetchBunnyThumbnailUrl(movie.bunnyVideoId)
          return [movie.id, thumbnailUrl]
        })
      )

      if (isCancelled) {
        return
      }

      setThumbnailUrls((current) => {
        const next = { ...current }

        thumbnailEntries.forEach(([movieId, thumbnailUrl]) => {
          if (thumbnailUrl) {
            next[movieId] = thumbnailUrl
          }
        })

        return next
      })
    }

    void hydrateEpisodeThumbnails()

    return () => {
      isCancelled = true
    }
  }, [movies])

  return (
    <section className={`thumb-section ${embedded ? 'thumb-section-embedded' : ''}`}>
      <div className="thumb-tabs">
        {tabs.map((tab, index) => {
          const tabId = typeof tab === 'string' ? tab : tab.id
          const tabLabel = typeof tab === 'string' ? tab : tab.label
          const isActive = activeTab ? activeTab === tabId : index === 0

          return (
            <button
              key={tabId}
              className={`tab ${isActive ? 'active' : ''}`}
              type="button"
              onClick={() => onTabChange?.(tabId)}
            >
              {tabLabel}
            </button>
          )
        })}
      </div>

      <div className="thumb-row">
        {movies.map((movie) => {
          const progressValue = Math.min(
            100,
            Math.max(0, getPlaybackProgress(movie.id, movie.progress ?? 0))
          )

          return (
            <Link to={getItemHref(movie)} key={movie.id} className="thumb-card">
              <img
                src={thumbnailUrls[movie.id] || movie.poster || movie.backdrop}
                alt={movie.title}
                className="thumb-image"
              />
              <div className="thumb-overlay" />
              <div className="thumb-content">
                <div className="thumb-footer">
                  <p>{movie.episodeTitle || movie.title}</p>
                  <span className="thumb-play-btn" aria-hidden="true">
                    <svg viewBox="0 0 24 24" role="presentation" focusable="false">
                      <path d="M8 6.5v11l9-5.5-9-5.5Z" />
                    </svg>
                  </span>
                </div>
                <div className="thumb-progress">
                  <div
                    className="thumb-progress-fill"
                    style={{ width: `${progressValue}%` }}
                  />
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {movies.length === 0 && <p className="empty-state">No titles match this search.</p>}
    </section>
  )
}
