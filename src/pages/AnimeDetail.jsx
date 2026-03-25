import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import MediaCardLink from '../components/MediaCardLink'
import RatingInline from '../components/RatingInline'
import Sidebar from '../components/Sidebar'
import Topbar from '../components/Topbar'
import ThumbnailRow from '../components/ThumbnailRow'
import anime from '../data/anime'
import { useAccount } from '../context/AccountContext'
import { getBackgroundImageStyle } from '../utils/media'
import { getRatingValue } from '../utils/rating'

function getRelatedShows(show) {
  return anime
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

function getAnimeAudioMode(search) {
  const requestedMode = new URLSearchParams(search).get('audio')

  return requestedMode === 'dub' ? 'dub' : 'sub'
}

function buildAnimeAudioSearch(search, mode) {
  const nextSearchParams = new URLSearchParams(search)
  nextSearchParams.set('audio', mode)
  return `?${nextSearchParams.toString()}`
}

export default function AnimeDetail() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const {
    continueWatchingItems,
    isFavorite,
    isInContinueWatching,
    removeContinueWatching,
    toggleFavorite,
  } = useAccount()
  const show = anime.find((item) => item.id === id)
  const seasons = show?.seasonsData ?? []
  const [activeSeasonId, setActiveSeasonId] = useState(seasons[0]?.id ?? '')
  const activeSeason = seasons.find((season) => season.id === activeSeasonId) ?? seasons[0]
  const relatedShows = useMemo(() => (show ? getRelatedShows(show) : []), [show])
  const animeAudioMode = getAnimeAudioMode(location.search)
  const animeAudioSearch = buildAnimeAudioSearch(location.search, animeAudioMode)
  const currentPath = `${location.pathname}${location.search}${location.hash}`

  if (!show) {
    return (
      <div className="app-shell">
        <Sidebar />
        <main className="watch-page">
          <h2>Anime title not found</h2>
          <Link to="/anime">Go back to Anime</Link>
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
  const playHref = defaultEpisode?.id ? `/watch/${defaultEpisode.id}${animeAudioSearch}` : '#episode-guide'
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

  const handleAnimeAudioModeChange = (nextMode) => {
    navigate(
      {
        pathname: location.pathname,
        search: buildAnimeAudioSearch(location.search, nextMode),
      },
      { replace: true }
    )
  }

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
              afterTabsContent={
                <div className="anime-audio-mode-bar" aria-label="Anime audio mode">
                  <span className="anime-audio-mode-label">Audio</span>

                  <div
                    className="anime-audio-mode-options"
                    data-active-mode={animeAudioMode}
                    role="tablist"
                    aria-label="Audio version"
                  >
                    {[
                      { id: 'sub', label: 'Sub' },
                      { id: 'dub', label: 'Dub' },
                    ].map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        className={`anime-audio-mode-btn ${
                          animeAudioMode === option.id ? 'is-active' : ''
                        }`}
                        role="tab"
                        aria-selected={animeAudioMode === option.id}
                        onClick={() => handleAnimeAudioModeChange(option.id)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              }
              getItemHref={(episode) => `/watch/${episode.id}${animeAudioSearch}`}
            />
          </section>

          {relatedShows.length > 0 && (
            <section className="watch-related-section">
              <div className="watch-section-heading">
                <p className="watch-panel-kicker">Recommended</p>
                <h2>More anime to watch next</h2>
              </div>

              <div className="watch-related-grid">
                {relatedShows.map((item) => (
                  <MediaCardLink item={item} to={`/anime/${item.id}`} key={item.id} className="watch-related-card">
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
