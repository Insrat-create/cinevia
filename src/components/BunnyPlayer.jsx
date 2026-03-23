import { useEffect, useMemo, useRef } from 'react'
import { getBunnyEmbedUrl } from '../utils/bunny'

let bunnyPlayerScriptPromise

function loadBunnyPlayerScript() {
  if (typeof window === 'undefined') {
    return Promise.resolve(null)
  }

  if (window.playerjs?.Player) {
    return Promise.resolve(window.playerjs.Player)
  }

  if (bunnyPlayerScriptPromise) {
    return bunnyPlayerScriptPromise
  }

  bunnyPlayerScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector('script[data-bunny-playerjs="true"]')

    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(window.playerjs?.Player ?? null), {
        once: true,
      })
      existingScript.addEventListener('error', reject, { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = 'https://assets.mediadelivery.net/playerjs/playerjs-latest.min.js'
    script.async = true
    script.dataset.bunnyPlayerjs = 'true'
    script.onload = () => resolve(window.playerjs?.Player ?? null)
    script.onerror = reject
    document.body.appendChild(script)
  })

  return bunnyPlayerScriptPromise
}

export default function BunnyPlayer({ onEnded, onNearEnd, onProgressChange, title, videoId }) {
  const iframeRef = useRef(null)
  const onEndedRef = useRef(onEnded)
  const onNearEndRef = useRef(onNearEnd)
  const onProgressChangeRef = useRef(onProgressChange)
  const hasTriggeredNearEndRef = useRef(false)

  useEffect(() => {
    onEndedRef.current = onEnded
  }, [onEnded])

  useEffect(() => {
    onNearEndRef.current = onNearEnd
  }, [onNearEnd])

  useEffect(() => {
    onProgressChangeRef.current = onProgressChange
  }, [onProgressChange])

  const embedUrl = useMemo(() => {
    const url = new URL(getBunnyEmbedUrl(videoId))
    url.searchParams.set('instance', `${videoId}-${Date.now()}`)
    return url.toString()
  }, [videoId])

  useEffect(() => {
    hasTriggeredNearEndRef.current = false
  }, [videoId])

  useEffect(() => {
    if (!videoId || !iframeRef.current) {
      return undefined
    }

    let isCancelled = false
    let player = null
    let handleTimeUpdate = null
    let handleEnded = null

    const bindPlayerEvents = async () => {
      try {
        const Player = await loadBunnyPlayerScript()

        if (!Player || isCancelled || !iframeRef.current) {
          return
        }

        player = new Player(iframeRef.current)

        handleTimeUpdate = (data) => {
          if (!data?.duration) {
            return
          }

          const nextProgress = Math.min(
            100,
            Math.max(0, Math.round((data.seconds / data.duration) * 100))
          )
          const remainingSeconds = Math.max(0, data.duration - data.seconds)

          onProgressChangeRef.current?.(nextProgress)

          if (
            !hasTriggeredNearEndRef.current &&
            (remainingSeconds <= 45 || nextProgress >= 92)
          ) {
            hasTriggeredNearEndRef.current = true
            onNearEndRef.current?.()
          }
        }

        handleEnded = () => {
          hasTriggeredNearEndRef.current = true
          onProgressChangeRef.current?.(100)
          onEndedRef.current?.()
        }

        player.on('timeupdate', handleTimeUpdate)
        player.on('ended', handleEnded)
      } catch {
        // If the Bunny control API fails to load, playback should still work.
      }
    }

    void bindPlayerEvents()

    return () => {
      isCancelled = true

      if (player) {
        if (handleTimeUpdate) {
          player.off('timeupdate', handleTimeUpdate)
        }

        if (handleEnded) {
          player.off('ended', handleEnded)
        }
      }
    }
  }, [embedUrl, videoId])

  if (!videoId) {
    return <p>Video is not available yet.</p>
  }

  return (
    <div className="bunny-player-wrap">
      <iframe
        ref={iframeRef}
        src={embedUrl}
        title={title}
        loading="lazy"
        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
        className="bunny-player"
      />
    </div>
  )
}
