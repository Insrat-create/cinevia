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
  const { isAnimeAccessAllowed, isLoading, openAuthModal, profile, user } = useAccount()
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

  const displayName = isLoading ? '' : profile.displayName || user?.email?.split('@')[0] || 'Guest'
  const initial = displayName ? displayName.slice(0, 1).toUpperCase() : ''

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
          {!isLoading && isAnimeAccessAllowed && (
            <Link to="/anime" className={linkClass('/anime')}>
              Anime
            </Link>
          )}
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
          <button
            className={`profile-pill profile-trigger ${isLoading ? 'is-loading' : ''}`}
            type="button"
            onClick={() => openAuthModal()}
            aria-busy={isLoading}
          >
            <div className={`profile-avatar ${isLoading ? 'is-loading' : ''}`}>{initial}</div>
            <span className={isLoading ? 'profile-pill-placeholder' : ''}>
              {isLoading ? '' : displayName}
            </span>
          </button>
        </div>
      </header>

      <AccountModal />
    </>
  )
}
