import { useId } from 'react'
import { getRatingValue, getRoundedRatingValue } from '../utils/rating'

const STAR_PATH =
  'M12 2.75l2.85 5.78 6.38.93-4.61 4.49 1.09 6.35L12 17.3l-5.71 3 1.09-6.35-4.61-4.49 6.38-.93L12 2.75z'

function RatingStar({ fillLevel, starId }) {
  const clipPathId = `${starId}-clip`
  const fillWidth = 24 * fillLevel
  const outlineColor =
    fillLevel > 0 ? 'rgba(247, 201, 72, 0.98)' : 'rgba(255, 255, 255, 0.22)'

  return (
    <svg className="rating-star-svg" viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <clipPath id={clipPathId}>
          <path d={STAR_PATH} />
        </clipPath>
      </defs>

      <path d={STAR_PATH} className="rating-star-base" />

      {fillLevel > 0 && (
        <rect
          x="0"
          y="0"
          width={fillWidth}
          height="24"
          className="rating-star-fill-shape"
          clipPath={`url(#${clipPathId})`}
        />
      )}

      <path d={STAR_PATH} fill="none" stroke={outlineColor} strokeWidth="1.15" strokeLinejoin="round" />
    </svg>
  )
}

export default function RatingInline({ source, prefix = '', className = '' }) {
  const baseId = useId()
  const ratingValue = getRatingValue(source)
  const roundedRatingValue = getRoundedRatingValue(source)

  if (!ratingValue || roundedRatingValue === null) {
    return null
  }

  const classes = ['rating-inline', className].filter(Boolean).join(' ')
  const ariaPrefix = prefix ? `${prefix} ` : ''
  const starFills = Array.from({ length: 5 }, (_, index) =>
    Math.max(0, Math.min(1, roundedRatingValue - index))
  )

  return (
    <span className={classes} aria-label={`${ariaPrefix}${ratingValue} out of 5 stars`}>
      {prefix && <span className="rating-prefix">{prefix}</span>}

      <span className="rating-stars" aria-hidden="true">
        {starFills.map((fill, index) => (
          <span key={`${index}-${fill}`} className="rating-star">
            <RatingStar fillLevel={fill} starId={`${baseId}-${index}`} />
          </span>
        ))}
      </span>
    </span>
  )
}
