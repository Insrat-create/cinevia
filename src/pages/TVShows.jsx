import { useSearchParams } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import Topbar from '../components/Topbar'
import HeroFeature from '../components/HeroFeature'
import SectionRow from '../components/SectionRow'
import tvShows from '../data/tvShows'
import useHeroTopState from '../hooks/useHeroTopState'
import { getTvRows } from '../utils/catalogRows'
import { rankByQuery } from '../utils/search'

export default function TVShows() {
  const [searchParams] = useSearchParams()
  const query = (searchParams.get('q') ?? '').trim().toLowerCase()
  const isSearching = Boolean(query)
  const isHeroAtTop = useHeroTopState(!isSearching)
  const filteredShows = rankByQuery(tvShows, query)
  const tvRows = getTvRows(tvShows)
  const featured = tvRows[0]?.items[0] ?? tvShows[0]
  const getShowHref = (show) => `/tv-shows/${show.id}`

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
              {tvRows.map((row) => (
                <SectionRow
                  key={row.title}
                  title={row.title}
                  items={row.items}
                  getItemHref={getShowHref}
                />
              ))}
            </>
          )}
        </div>
      </main>
    </div>
  )
}
