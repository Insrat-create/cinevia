import { Link } from 'react-router-dom'

export default function HeroFeature({ movie, isAtTop = false, showInfoButton = true }) {
  const maturityRating = movie?.maturityRating ?? 'NR'

  if (!movie) {
    return (
      <section className={`hero-feature fallback-hero ${isAtTop ? 'hero-feature-top' : ''}`}>
        <div className="hero-inner">
          <h1 className="hero-heading">Featured content coming soon</h1>
        </div>
      </section>
    )
  }

  const infoHref = movie.seasons ? `/tv-shows/${movie.id}` : `/movies/${movie.id}`
  const heroLayout = movie.heroLayout ?? {}
  const heroStyle = {
    '--hero-backdrop-image': movie.backdrop ? `url(${JSON.stringify(movie.backdrop)})` : 'none',
    '--hero-mobile-image': `url(${JSON.stringify(movie.poster ?? movie.backdrop ?? '')})`,
    '--hero-copy-max-width': heroLayout.copyMaxWidth,
    '--hero-summary-max-width': heroLayout.summaryMaxWidth,
    '--hero-copy-padding-top': heroLayout.copyPaddingTop,
    '--hero-copy-padding-bottom': heroLayout.copyPaddingBottom,
    '--hero-copy-shift': heroLayout.copyShift,
    '--hero-copy-padding-top-top': heroLayout.copyPaddingTopTop,
    '--hero-copy-padding-bottom-top': heroLayout.copyPaddingBottomTop,
    '--hero-copy-shift-top': heroLayout.copyShiftTop,
    '--hero-copy-panel-opacity': heroLayout.panelOpacity,
  }

  return (
    <section
      className={`hero-feature ${isAtTop ? 'hero-feature-top' : ''}`}
      style={heroStyle}
    >
      <div className="hero-gradient-bottom" />

      <div className="hero-inner hero-artwork-copy">
        <div className="hero-copy-card">
          <p className="hero-summary">{movie.description}</p>

          <div className="hero-actions">
            <Link to={`/watch/${movie.id}`} className="play-btn">
              Play
            </Link>
            {showInfoButton && (
              <Link className="hero-info-btn" to={infoHref}>
                More Info
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="hero-maturity-badge">{maturityRating}</div>
    </section>
  )
}
