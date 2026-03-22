import { useSearchParams } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import Topbar from '../components/Topbar'
import HeroFeature from '../components/HeroFeature'
import SectionRow from '../components/SectionRow'
import movies from '../data/movies'
import useHeroTopState from '../hooks/useHeroTopState'
import { rankByQuery } from '../utils/search'

export default function Movies() {
  const [searchParams] = useSearchParams()
  const query = (searchParams.get('q') ?? '').trim().toLowerCase()
  const isSearching = Boolean(query)
  const isHeroAtTop = useHeroTopState(!isSearching)
  const filteredMovies = rankByQuery(movies, query)
  const featured = filteredMovies[0] ?? movies[0]

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
            <SectionRow title={`Search Results for "${query}"`} items={filteredMovies} />
          ) : (
            <>
              <SectionRow title="Popular Movies" items={filteredMovies} />
              <SectionRow title="Action Picks" items={filteredMovies} />
              <SectionRow title="Drama Spotlight" items={filteredMovies} />
            </>
          )}
        </div>
      </main>
    </div>
  )
}
