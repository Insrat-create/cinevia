import { useSearchParams } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import Topbar from '../components/Topbar'
import HeroFeature from '../components/HeroFeature'
import SectionRow from '../components/SectionRow'
import tvShows from '../data/tvShows'
import useHeroTopState from '../hooks/useHeroTopState'
import { rankByQuery } from '../utils/search'

function matchesGenres(show, genres) {
  const showGenres =
    Array.isArray(show.genres) && show.genres.length > 0
      ? show.genres
      : [show.genre].filter(Boolean)

  return showGenres.some((genre) => genres.includes(genre))
}

export default function TVShows() {
  const [searchParams] = useSearchParams()
  const query = (searchParams.get('q') ?? '').trim().toLowerCase()
  const isSearching = Boolean(query)
  const isHeroAtTop = useHeroTopState(!isSearching)
  const filteredShows = rankByQuery(tvShows, query)
  const featured = filteredShows[0] ?? tvShows[0]
  const getShowHref = (show) => `/tv-shows/${show.id}`

  const fantasyAndSciFi = filteredShows.filter((show) =>
    matchesGenres(show, ['Fantasy', 'Sci-Fi'])
  )
  const animationAndComedy = filteredShows.filter((show) =>
    matchesGenres(show, ['Animation', 'Comedy', 'Adult Animation', 'Crude Humor'])
  )
  const dramaAndThriller = filteredShows.filter((show) =>
    matchesGenres(show, ['Drama', 'Thriller'])
  )

  return (
    <div className="app-shell">
      <Sidebar />

      <main className={`main-shell page-scroll ${isHeroAtTop ? 'hero-page-top' : ''}`}>
        <Topbar
          heroBackdrop={!isSearching ? featured?.backdrop : undefined}
          heroSearchTone={!isSearching ? featured?.heroSearchTone : undefined}
          enableHeroAdaptiveSearch={!isSearching}
        />
        {!isSearching && <HeroFeature movie={featured} isAtTop={isHeroAtTop} />}

        <div className={`page-content-stack ${isSearching ? 'search-results-stack' : ''}`}>
          {isSearching ? (
            <SectionRow
              title={`Search Results for "${query}"`}
              items={filteredShows}
              getItemHref={getShowHref}
            />
          ) : (
            <>
              <SectionRow
                title="Popular TV Shows"
                items={filteredShows}
                getItemHref={getShowHref}
              />
              <SectionRow
                title="Sci-Fi & Fantasy"
                items={fantasyAndSciFi}
                getItemHref={getShowHref}
              />
              <SectionRow
                title="Animation & Comedy"
                items={animationAndComedy}
                getItemHref={getShowHref}
              />
              <SectionRow
                title="Drama & Thriller"
                items={dramaAndThriller}
                getItemHref={getShowHref}
              />
            </>
          )}
        </div>
      </main>
    </div>
  )
}
