import { useSearchParams } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import Topbar from '../components/Topbar'
import HeroFeature from '../components/HeroFeature'
import SectionRow from '../components/SectionRow'
import movies from '../data/movies'
import tvShows from '../data/tvShows'
import { useAccount } from '../context/AccountContext'
import useHeroTopState from '../hooks/useHeroTopState'
import { getHomeRows } from '../utils/catalogRows'
import { getDailyFeaturedItem } from '../utils/featured'
import { rankByQuery } from '../utils/search'

export default function Home() {
  const [searchParams] = useSearchParams()
  const { continueWatchingItems, favoriteItems, isSignedIn } = useAccount()
  const query = (searchParams.get('q') ?? '').trim().toLowerCase()
  const isSearching = Boolean(query)
  const isHeroAtTop = useHeroTopState(!isSearching)
  const allContent = [...movies, ...tvShows]
  const homeRows = getHomeRows(movies, tvShows)

  const searchResults = rankByQuery(allContent, query)
  const featured = getDailyFeaturedItem(allContent, 'home') ?? homeRows[0]?.items[0] ?? tvShows[0]

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
                showProgress
                emptyMessage={
                  isSignedIn
                    ? 'Keep watching and your saved titles will show up here.'
                    : 'Sign in or create an account to save titles to continue watching.'
                }
              />
              {favoriteItems.length > 0 && (
                <SectionRow
                  title="My List"
                  items={favoriteItems}
                  getItemHref={(item) => item.resumePath ?? `/watch/${item.id}`}
                />
              )}
              {homeRows.map((row) => (
                <SectionRow
                  key={row.title}
                  title={row.title}
                  items={row.items}
                  getItemHref={row.getItemHref}
                />
              ))}
            </>
          )}
        </div>
      </main>
    </div>
  )
}
