import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAccount } from '../context/AccountContext'
import RatingInline from './RatingInline'

export default function SectionRow({
  title,
  items = [],
  getItemHref = (item) => (item.seasons ? `/tv-shows/${item.id}` : `/movies/${item.id}`),
  emptyMessage = 'No titles match this search.',
}) {
  const { isFavorite, toggleFavorite } = useAccount()
  const location = useLocation()
  const railRef = useRef(null)
  const [canScrollBackward, setCanScrollBackward] = useState(false)
  const [canScrollForward, setCanScrollForward] = useState(false)
  const currentPath = `${location.pathname}${location.search}${location.hash}`

  useEffect(() => {
    const rail = railRef.current

    if (!rail) {
      return
    }

    const updateScrollState = () => {
      const maxScrollLeft = rail.scrollWidth - rail.clientWidth

      setCanScrollBackward(rail.scrollLeft > 8)
      setCanScrollForward(maxScrollLeft - rail.scrollLeft > 8)
    }

    updateScrollState()
    rail.addEventListener('scroll', updateScrollState, { passive: true })
    window.addEventListener('resize', updateScrollState)

    return () => {
      rail.removeEventListener('scroll', updateScrollState)
      window.removeEventListener('resize', updateScrollState)
    }
  }, [items])

  const scrollRail = (direction) => {
    const rail = railRef.current

    if (!rail) {
      return
    }

    const firstCard = rail.querySelector('.poster-card')
    const railStyles = window.getComputedStyle(rail)
    const gap = Number.parseFloat(railStyles.columnGap || railStyles.gap || '0') || 0
    const cardWidth = firstCard?.offsetWidth ?? rail.clientWidth * 0.5
    const scrollAmount = (cardWidth + gap) * 5

    rail.scrollBy({
      behavior: 'smooth',
      left: direction * scrollAmount,
    })
  }

  const getMetaItems = (item) => {
    const meta = []

    if (item.year) {
      meta.push(item.year)
    }

    if (item.maturityRating) {
      meta.push(item.maturityRating)
    }

    if (item.seasons) {
      meta.push(item.seasons)
    } else if (item.duration) {
      meta.push(item.duration)
    }

    return meta
  }

  const handleFavoriteClick = (event, item) => {
    event.preventDefault()
    event.stopPropagation()

    const favoriteTarget = item.parentShow ?? item
    void toggleFavorite(favoriteTarget)
  }

  return (
    <section className="section-row">
      <div className="section-row-header">
        <h2>{title}</h2>
        {items.length > 0 && <a href="#">See all</a>}
      </div>

      {items.length > 0 ? (
        <div
          className={`section-row-rail-shell ${canScrollForward ? 'has-forward' : ''} ${canScrollBackward ? 'has-backward' : ''}`}
        >
          {canScrollBackward && (
            <button
              className="rail-arrow rail-arrow-left"
              type="button"
              aria-label={`Scroll ${title} left`}
              onClick={() => scrollRail(-1)}
            >
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path
                  d="M11.75 4.75L6.5 10l5.25 5.25"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                />
              </svg>
            </button>
          )}

          <div ref={railRef} className="poster-rail" aria-label={title}>
            {items.map((item) => {
              const favoriteTarget = item.parentShow ?? item
              const favoriteTitle = favoriteTarget.title ?? item.title
              const isItemFavorite = isFavorite(favoriteTarget.id)

              return (
                <Link
                  to={getItemHref(item)}
                  state={{ from: currentPath }}
                  key={item.id}
                  className="poster-card"
                >
                  <div className="poster-image-wrap">
                    <img
                      src={item.backdrop ?? item.poster}
                      alt={item.title}
                      className="poster-image"
                    />
                    <div className="poster-image-overlay" />
                  </div>

                  <div className="poster-hover-panel">
                    <div className="poster-hover-header">
                      <h3 className="poster-hover-title">{item.title}</h3>

                      <div className="poster-hover-actions">
                        <button
                          type="button"
                          className={`poster-hover-plus ${isItemFavorite ? 'active' : ''}`}
                          aria-label={
                            isItemFavorite
                              ? `Remove ${favoriteTitle} from My List`
                              : `Add ${favoriteTitle} to My List`
                          }
                          aria-pressed={isItemFavorite}
                          onClick={(event) => handleFavoriteClick(event, item)}
                        >
                          {isItemFavorite ? '✓' : '+'}
                        </button>
                      </div>
                    </div>

                    <div className="poster-hover-meta">
                      <RatingInline source={item} className="poster-hover-rating" />

                      {getMetaItems(item).map((metaItem) => (
                        <span key={`${item.id}-${metaItem}`} className="poster-hover-chip">
                          {metaItem}
                        </span>
                      ))}
                    </div>

                    {item.description && <p>{item.description}</p>}
                  </div>
                </Link>
              )
            })}
          </div>

          {canScrollForward && (
            <button
              className="rail-arrow rail-arrow-right"
              type="button"
              aria-label={`Scroll ${title} right`}
              onClick={() => scrollRail(1)}
            >
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path
                  d="M8.25 4.75L13.5 10l-5.25 5.25"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                />
              </svg>
            </button>
          )}
        </div>
      ) : (
        <p className="empty-state">{emptyMessage}</p>
      )}
    </section>
  )
}
