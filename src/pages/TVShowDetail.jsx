import { useMemo, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import MediaCardLink from '../components/MediaCardLink'
import RatingInline from '../components/RatingInline'
import Sidebar from '../components/Sidebar'
import Topbar from '../components/Topbar'
import ThumbnailRow from '../components/ThumbnailRow'
import tvShows from '../data/tvShows'
import { useAccount } from '../context/AccountContext'
import { getBackgroundImageStyle } from '../utils/media'
import { getRatingValue } from '../utils/rating'

function getRelatedShows(show) {
  return tvShows
    .filter((item) => item.id !== show.id)
    .sort((left, right) => {
      const scoreItem = (item) => {
        let score = 0

        if ((item.genre ?? item.badge) === (show.genre ?? show.badge)) {
          score += 3
        }

        if (item.maturityRating === show.maturityRating) {
          score += 2
        }

        if (item.seasons === show.seasons) {
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

export default function TVShowDetail() {
  const { id } = useParams()
  const location = useLocation()
  const {
    continueWatchingItems,
    isFavorite,
    isInContinueWatching,
    removeContinueWatching,
    toggleFavorite,
  } = useAccount()
  const show = tvShows.find((item) => item.id === id)
  const seasons = show?.seasonsData ?? []
  const [activeSeasonId, setActiveSeasonId] = useState(seasons[0]?.id ?? '')
  const activeSeason = seasons.find((season) => season.id === activeSeasonId) ?? seasons[0]
  const relatedShows = useMemo(() => (show ? getRelatedShows(show) : []), [show])
  const currentPath = `${location.pathname}${location.search}${location.hash}`

  if (!show) {
    return (
      <div className="app-shell">
        <Sidebar />
        <main className="watch-page">
          <h2>TV show not found</h2>
          <Link to="/tv-shows">Go back to TV Shows</Link>
        </main>
      </div>
    )
  }

  const allEpisodes = seasons.flatMap((season) =>
    season.episodes.map((episode) => ({
      ...episode,
      seasonLabel: season.label,
    }))
  )
  const continueEntry = continueWatchingItems.find((item) => item.parentShowId === show.id)
  const defaultEpisode = continueEntry ?? allEpisodes[0]
  const playHref = defaultEpisode?.id ? `/watch/${defaultEpisode.id}` : '#episode-guide'
  const playLabel = continueEntry ? 'Continue Watching' : 'Play First Episode'
  const totalEpisodesLabel = show.totalEpisodes
    ? `${show.totalEpisodes} Episodes`
    : `${allEpisodes.length} Episodes`
  const canRemoveFromContinueWatching = isInContinueWatching(show)
  const ratingValue = getRatingValue(show)
  const metaItems = [
    show.genre ?? show.badge,
    show.year,
    show.maturityRating,
    show.seasons,
    totalEpisodesLabel,
  ].filter(Boolean)

  return (
    <div className="app-shell">
      <Sidebar />

      <main className="watch-page tv-show-detail-page">
        <div
          className="watch-backdrop"
          style={getBackgroundImageStyle(show.backdrop)}
          aria-hidden="true"
        />
        <div className="watch-page-scrim" />
        <div className="watch-page-glow" aria-hidden="true" />

        <Topbar showSearch={false} />

        <div className="watch-page-inner show-detail-inner">
          <section className="watch-spotlight">
            <div className="watch-copy">
              <h1>{show.title}</h1>

              <div className="watch-meta-row" aria-label="Show details">
                {ratingValue && (
                  <span className="watch-meta-pill">
                    <RatingInline source={show} prefix="Rating" />
                  </span>
                )}

                {metaItems.map((metaItem) => (
                  <span key={`${show.id}-${metaItem}`} className="watch-meta-pill">
                    {metaItem}
                  </span>
                ))}
              </div>

              <p className="watch-description">{show.description}</p>

              <div className="watch-hero-actions">
                <Link
                  to={playHref}
                  state={{ autoplay: true, from: currentPath }}
                  className="watch-primary-btn"
                >
                  {playLabel}
                </Link>

                {canRemoveFromContinueWatching && (
                  <button
                    type="button"
                    className="watch-secondary-btn"
                    onClick={() => removeContinueWatching(show)}
                  >
                    Remove from Continue Watching
                  </button>
                )}

                <button
                  className={`watch-list-btn ${isFavorite(show.id) ? 'active' : ''}`}
                  type="button"
                  onClick={() => toggleFavorite(show)}
                >
                  {isFavorite(show.id) ? 'Remove from My List' : 'Add to My List'}
                </button>
              </div>
            </div>

            <aside className="watch-sidecard">
              <div className="watch-sidecard-media">
                <img src={show.poster} alt={show.title} />
                <div className="watch-sidecard-overlay" />
                <span className="watch-sidecard-badge">{show.maturityRating ?? 'NR'}</span>
              </div>
            </aside>
          </section>

          <section className="show-guide-shell" id="episode-guide">
            <div className="watch-section-heading">
              <h2>{activeSeason?.label ?? 'Episodes'}</h2>
            </div>

            <ThumbnailRow
              embedded
              movies={activeSeason?.episodes ?? []}
              tabs={seasons.map((season) => ({ id: season.id, label: season.label }))}
              activeTab={activeSeason?.id}
              onTabChange={setActiveSeasonId}
              getItemHref={(episode) => `/watch/${episode.id}`}
            />
          </section>

          {relatedShows.length > 0 && (
            <section className="watch-related-section">
              <div className="watch-section-heading">
                <p className="watch-panel-kicker">Recommended</p>
                <h2>More shows to watch next</h2>
              </div>

              <div className="watch-related-grid">
                {relatedShows.map((item) => (
                  <MediaCardLink
                    item={item}
                    to={`/tv-shows/${item.id}`}
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
