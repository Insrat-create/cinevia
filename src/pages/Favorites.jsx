import { useSearchParams } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import Topbar from '../components/Topbar'
import SectionRow from '../components/SectionRow'
import { useAccount } from '../context/AccountContext'
import { rankByQuery } from '../utils/search'

export default function Favorites() {
  const [searchParams] = useSearchParams()
  const { favoriteItems } = useAccount()
  const query = (searchParams.get('q') ?? '').trim().toLowerCase()
  const items = query ? rankByQuery(favoriteItems, query) : favoriteItems

  return (
    <div className="app-shell">
      <Sidebar />

      <main className="main-shell page-scroll">
        <Topbar />

        <div className="page-content-stack search-results-stack">
          <SectionRow
            title={query ? `My List for "${query}"` : 'My List'}
            items={items}
            getItemHref={(item) => item.resumePath ?? `/watch/${item.id}`}
          />
        </div>
      </main>
    </div>
  )
}
