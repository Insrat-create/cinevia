import { useRef } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import AccountModal from './AccountModal'
import { useAccount } from '../context/AccountContext'
import useHeroSearchTone from '../hooks/useHeroSearchTone'

export default function Topbar({
  heroBackdrop,
  heroSearchTone,
  enableHeroAdaptiveSearch = false,
  showSearch = true,
}) {
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const { openAuthModal, profile, user } = useAccount()
  const query = searchParams.get('q') ?? ''
  const searchBoxRef = useRef(null)
  const searchTone = useHeroSearchTone({
    backdrop: heroBackdrop,
    overrideTone: heroSearchTone,
    enabled: enableHeroAdaptiveSearch,
    targetRef: searchBoxRef,
  })

  const linkClass = (path) => {
    if (path === '/') {
      return location.pathname === '/' ? 'active-link' : ''
    }

    return location.pathname.startsWith(path) ? 'active-link' : ''
  }

  const handleSearchChange = (event) => {
    const nextValue = event.target.value
    const nextParams = new URLSearchParams(searchParams)

    if (nextValue.trim()) {
      nextParams.set('q', nextValue)
    } else {
      nextParams.delete('q')
    }

    setSearchParams(nextParams, { replace: true })
  }

  const displayName = profile.displayName || user?.email?.split('@')[0] || 'Guest'
  const initial = displayName.slice(0, 1).toUpperCase()

  return (
    <>
      <header className="topbar">
        <nav className="topbar-links">
          <Link to="/" className={linkClass('/')}>
            Home
          </Link>
          <Link to="/movies" className={linkClass('/movies')}>
            Movies
          </Link>
          <Link to="/tv-shows" className={linkClass('/tv-shows')}>
            TV Shows
          </Link>
          <Link to="/favorites" className={linkClass('/favorites')}>
            My List
          </Link>
        </nav>

        <div className="topbar-actions">
          {showSearch && (
            <label
              className={`search-box ${searchTone === 'light' ? 'search-box-light' : 'search-box-dark'}`}
              aria-label="Search titles"
              ref={searchBoxRef}
            >
              <input
                type="search"
                value={query}
                onChange={handleSearchChange}
                className="search-input"
                placeholder="Search titles"
              />
            </label>
          )}
          <button className="profile-pill profile-trigger" type="button" onClick={() => openAuthModal()}>
            <div className="profile-avatar">{initial}</div>
            <span>{displayName}</span>
          </button>
        </div>
      </header>

      <AccountModal />
    </>
  )
}
