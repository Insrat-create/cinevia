import { useSearchParams } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import Topbar from '../components/Topbar'
import HeroFeature from '../components/HeroFeature'
import SectionRow from '../components/SectionRow'
import anime from '../data/anime'
import useHeroTopState from '../hooks/useHeroTopState'
import { getAnimeRows } from '../utils/catalogRows'
import { getDailyFeaturedItem } from '../utils/featured'
import { rankByQuery } from '../utils/search'

export default function Anime() {
  const [searchParams] = useSearchParams()
  const query = (searchParams.get('q') ?? '').trim().toLowerCase()
  const isSearching = Boolean(query)
  const isHeroAtTop = useHeroTopState(!isSearching)
  const filteredShows = rankByQuery(anime, query)
  const animeRows = getAnimeRows(anime)
  const featured = getDailyFeaturedItem(anime, 'anime') ?? animeRows[0]?.items[0] ?? anime[0]
  const getShowHref = (show) => `/anime/${show.id}`

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
              {animeRows.map((row) => (
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
