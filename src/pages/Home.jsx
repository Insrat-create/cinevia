import { useSearchParams } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import Topbar from '../components/Topbar'
import HeroFeature from '../components/HeroFeature'
import SectionRow from '../components/SectionRow'
import movies from '../data/movies'
import tvShows from '../data/tvShows'
import { useAccount } from '../context/AccountContext'
import useHeroTopState from '../hooks/useHeroTopState'
import { rankByQuery } from '../utils/search'

export default function Home() {
  const [searchParams] = useSearchParams()
  const { continueWatchingItems, favoriteItems } = useAccount()
  const query = (searchParams.get('q') ?? '').trim().toLowerCase()
  const isSearching = Boolean(query)
  const isHeroAtTop = useHeroTopState(!isSearching)
  const allContent = [...movies, ...tvShows]

  const filteredShows = rankByQuery(tvShows, query)
  const filteredMovies = rankByQuery(movies, query)
  const filteredNewReleases = rankByQuery([...movies, ...tvShows].slice(0, 4), query)
  const searchResults = rankByQuery(allContent, query)
  const featured = [...filteredShows, ...filteredMovies][0] ?? tvShows[0]

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
            <SectionRow title={`Search Results for "${query}"`} items={searchResults} />
          ) : (
            <>
              <SectionRow
                title="Continue Watching"
                items={continueWatchingItems}
                getItemHref={(item) => item.resumePath ?? `/watch/${item.id}`}
              />
              {favoriteItems.length > 0 && (
                <SectionRow
                  title="My List"
                  items={favoriteItems}
                  getItemHref={(item) => item.resumePath ?? `/watch/${item.id}`}
                />
              )}
              <SectionRow title="Trending Movies" items={filteredMovies} />
              <SectionRow title="Top TV Shows" items={filteredShows} />
              <SectionRow title="New Releases" items={filteredNewReleases} />
            </>
          )}
        </div>
      </main>
    </div>
  )
}
