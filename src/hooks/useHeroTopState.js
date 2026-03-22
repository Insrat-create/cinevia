import { useEffect, useState } from 'react'

export default function useHeroTopState(enabled = true, threshold = 12) {
  const [isAtTop, setIsAtTop] = useState(() => {
    if (typeof window === 'undefined') {
      return true
    }

    return window.scrollY <= threshold
  })

  useEffect(() => {
    if (!enabled) {
      setIsAtTop(false)
      return
    }

    const updateIsAtTop = () => {
      setIsAtTop(window.scrollY <= threshold)
    }

    updateIsAtTop()
    window.addEventListener('scroll', updateIsAtTop, { passive: true })

    return () => {
      window.removeEventListener('scroll', updateIsAtTop)
    }
  }, [enabled, threshold])

  return enabled && isAtTop
}
