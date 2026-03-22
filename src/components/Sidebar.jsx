import { Link, useLocation } from 'react-router-dom'
import { useAccount } from '../context/AccountContext'
import logo from '../assets/logo-tight.png'

function SidebarIcon({ name }) {
  const iconSrcByName = {
    home: '/icons/clean/home.png',
    movies: '/icons/clean/movies.png',
    tv: '/icons/clean/tv shows.png',
    favorites: '/icons/clean/favorites.png',
    search: '/icons/clean/search.png',
  }

  return (
    <img
      className={`sidebar-icon-image sidebar-icon-${name}`}
      src={iconSrcByName[name]}
      alt=""
      aria-hidden="true"
    />
  )
}

export default function Sidebar() {
  const location = useLocation()
  const { profile, user } = useAccount()
  const displayName = profile.displayName || user?.email?.split('@')[0] || 'Guest'
  const initial = displayName.slice(0, 1).toUpperCase()

  const primaryItems = [
    { icon: 'home', to: '/', label: 'Home' },
    { icon: 'movies', to: '/movies', label: 'Movies' },
    { icon: 'tv', to: '/tv-shows', label: 'TV Shows' },
  ]

  const secondaryItems = [
    { icon: 'favorites', to: '/favorites', label: 'Favorites' },
    { icon: 'search', to: '/search', label: 'Search' },
  ]

  const renderNavItem = (item) => {
    const isActive =
      item.to !== '#' &&
      (location.pathname === item.to ||
        (item.to !== '/' && location.pathname.startsWith(item.to)))

    const className = isActive ? 'sidebar-btn active' : 'sidebar-btn'
    const icon = <SidebarIcon name={item.icon} />

    if (item.to === '#') {
      return (
        <button
          key={item.label}
          className={className}
          type="button"
          aria-label={item.label}
          title={item.label}
        >
          {icon}
        </button>
      )
    }

    return (
      <Link
        key={item.label}
        to={item.to}
        className={className}
        aria-label={item.label}
        title={item.label}
      >
        {icon}
      </Link>
    )
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-glow" aria-hidden="true" />

      <div className="sidebar-top">
        <Link to="/" className="sidebar-logo-link" aria-label="Cinevia Home">
          <div className="sidebar-logo-shell">
            <div className="sidebar-logo-mark">
              <img className="sidebar-logo-image" src={logo} alt="" aria-hidden="true" />
            </div>
          </div>
        </Link>

        <div className="sidebar-nav">
          <div className="sidebar-nav-group">{primaryItems.map(renderNavItem)}</div>
          <div className="sidebar-divider" />
          <div className="sidebar-nav-group sidebar-nav-muted">
            {secondaryItems.map(renderNavItem)}
          </div>
        </div>
      </div>

      <div className="sidebar-bottom">
        <div className="sidebar-avatar-wrap">
          <div className="sidebar-avatar">{initial}</div>
        </div>
      </div>
    </aside>
  )
}
