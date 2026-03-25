import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAccount } from '../context/AccountContext'
import { getDetailPath } from '../utils/catalogPaths'
import MediaCardLink from './MediaCardLink'
import RatingInline from './RatingInline'

function PosterArtwork({ src, alt, eager = false, children = null }) {
  const imageRef = useRef(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    setIsLoaded(false)
    setHasError(false)
  }, [src])

  useEffect(() => {
    const image = imageRef.current

    if (image?.complete && image.naturalWidth > 0) {
      setIsLoaded(true)
    }
  }, [src])

  const imageStateClassName = hasError ? 'has-error' : isLoaded ? 'is-ready' : 'is-loading'

  return (
    <div className={`poster-image-wrap ${imageStateClassName}`}>
      <div className="poster-image-placeholder" aria-hidden="true" />
      <img
        ref={imageRef}
        src={src}
        alt={alt}
        className="poster-image"
        decoding="async"
        loading={eager ? 'eager' : 'lazy'}
        fetchPriority={eager ? 'high' : 'auto'}
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
      />
      <div className="poster-image-overlay" />
      {children}
    </div>
  )
}

export default function SectionRow({
  title,
  items = [],
  getItemHref = (item) => getDetailPath(item),
  emptyMessage = 'No titles match this search.',
  showProgress = false,
}) {
  const { getPlaybackProgress, isFavorite, toggleFavorite } = useAccount()
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
            {items.map((item, index) => {
              const favoriteTarget = item.parentShow ?? item
              const favoriteTitle = favoriteTarget.title ?? item.title
              const isItemFavorite = isFavorite(favoriteTarget.id)
              const progressValue = showProgress
                ? Math.min(100, Math.max(0, getPlaybackProgress(item.id, item.progress ?? 0)))
                : 0

              return (
                <MediaCardLink
                  item={item}
                  to={getItemHref(item)}
                  state={{ from: currentPath }}
                  key={item.id}
                  className="poster-card"
                >
                  <PosterArtwork
                    src={item.backdrop ?? item.poster}
                    alt={item.title}
                    eager={index < 2}
                  >
                    {showProgress && progressValue > 0 ? (
                      <div className="poster-progress" aria-hidden="true">
                        <div
                          className="poster-progress-fill"
                          style={{ width: `${progressValue}%` }}
                        />
                      </div>
                    ) : null}
                  </PosterArtwork>

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
                </MediaCardLink>
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
