import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import { useAccount } from '../context/AccountContext'
import { getDetailPath } from '../utils/catalogPaths'

export default function MediaCardLink({
  children,
  className,
  continueWatchingTarget,
  favoriteTarget,
  item,
  state,
  to,
}) {
  const menuRef = useRef(null)
  const navigate = useNavigate()
  const [menuPosition, setMenuPosition] = useState(null)
  const [resolvedMenuPosition, setResolvedMenuPosition] = useState(null)
  const { isFavorite, isInContinueWatching, removeContinueWatching, toggleFavorite } = useAccount()
  const resolvedFavoriteTarget = favoriteTarget ?? item?.parentShow ?? item ?? null
  const resolvedContinueWatchingTarget =
    continueWatchingTarget ?? item?.parentShow ?? item ?? null
  const detailPath = getDetailPath(resolvedFavoriteTarget ?? item)
  const isItemFavorite = resolvedFavoriteTarget ? isFavorite(resolvedFavoriteTarget.id) : false
  const isItemInContinueWatching = resolvedContinueWatchingTarget
    ? isInContinueWatching(resolvedContinueWatchingTarget)
    : false

  useLayoutEffect(() => {
    if (!menuPosition || !menuRef.current || typeof window === 'undefined') {
      return
    }

    const padding = 12
    const { offsetHeight, offsetWidth } = menuRef.current

    setResolvedMenuPosition({
      left: Math.min(
        Math.max(padding, menuPosition.left),
        Math.max(padding, window.innerWidth - offsetWidth - padding)
      ),
      top: Math.min(
        Math.max(padding, menuPosition.top),
        Math.max(padding, window.innerHeight - offsetHeight - padding)
      ),
    })
  }, [menuPosition])

  useEffect(() => {
    if (!menuPosition) {
      return undefined
    }

    const closeMenu = () => {
      setMenuPosition(null)
      setResolvedMenuPosition(null)
    }

    const handlePointerDown = (event) => {
      if (menuRef.current?.contains(event.target)) {
        return
      }

      closeMenu()
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        closeMenu()
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('resize', closeMenu)
    window.addEventListener('scroll', closeMenu, true)
    window.addEventListener('keydown', handleEscape)

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('resize', closeMenu)
      window.removeEventListener('scroll', closeMenu, true)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [menuPosition])

  const closeMenu = () => {
    setMenuPosition(null)
    setResolvedMenuPosition(null)
  }

  const handleContextMenu = (event) => {
    event.preventDefault()
    event.stopPropagation()

    setMenuPosition({
      left: event.clientX,
      top: event.clientY,
    })
    setResolvedMenuPosition(null)
  }

  const handleToggleFavorite = async (event) => {
    event.preventDefault()
    event.stopPropagation()

    if (resolvedFavoriteTarget) {
      await toggleFavorite(resolvedFavoriteTarget)
    }

    closeMenu()
  }

  const handleRemoveContinueWatching = async (event) => {
    event.preventDefault()
    event.stopPropagation()

    if (resolvedContinueWatchingTarget) {
      await removeContinueWatching(resolvedContinueWatchingTarget)
    }

    closeMenu()
  }

  const handleViewDetails = (event) => {
    event.preventDefault()
    event.stopPropagation()

    if (detailPath) {
      navigate(detailPath)
    }

    closeMenu()
  }

  return (
    <>
      <Link to={to} state={state} className={className} onContextMenu={handleContextMenu}>
        {children}
      </Link>

      {menuPosition && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={menuRef}
              className="media-card-context-menu"
              style={resolvedMenuPosition ?? menuPosition}
              role="menu"
              aria-label={item?.title ? `${item.title} options` : 'Card options'}
            >
              <button
                type="button"
                className="media-card-context-menu-item"
                role="menuitem"
                onClick={handleViewDetails}
              >
                View Details
              </button>

              <button
                type="button"
                className="media-card-context-menu-item"
                role="menuitem"
                onClick={handleToggleFavorite}
              >
                {isItemFavorite ? 'Remove from My List' : 'Add to My List'}
              </button>

              <button
                type="button"
                className="media-card-context-menu-item"
                role="menuitem"
                disabled={!isItemInContinueWatching}
                onClick={handleRemoveContinueWatching}
              >
                Remove from Continue Watching
              </button>
            </div>,
            document.body
          )
        : null}
    </>
  )
}
