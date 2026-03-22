import { useEffect, useState } from 'react'

const DEFAULT_TONE = 'dark'

function resolveBackdropSource(backdrop) {
  if (!backdrop || typeof window === 'undefined') {
    return null
  }

  try {
    return new URL(backdrop, window.location.origin).href
  } catch {
    return backdrop
  }
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function getSampleRect(targetRect, heroRect) {
  const insetX = Math.max(6, targetRect.width * 0.06)
  const insetY = Math.max(4, targetRect.height * 0.1)

  const x = clamp(targetRect.left - heroRect.left + insetX, 0, heroRect.width)
  const y = clamp(targetRect.top - heroRect.top + insetY, 0, heroRect.height)
  const width = clamp(targetRect.width - insetX * 2, 1, heroRect.width - x)
  const height = clamp(targetRect.height - insetY * 2, 1, heroRect.height - y)

  return { x, y, width, height }
}

function sampleSearchTone(image, sampleRect, heroRect) {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { willReadFrequently: true })

  if (!ctx) {
    return DEFAULT_TONE
  }

  const naturalWidth = image.naturalWidth || image.width
  const naturalHeight = image.naturalHeight || image.height

  if (!naturalWidth || !naturalHeight || !heroRect.width || !heroRect.height) {
    return DEFAULT_TONE
  }

  const scale = Math.max(heroRect.width / naturalWidth, heroRect.height / naturalHeight)
  const renderedWidth = naturalWidth * scale
  const renderedHeight = naturalHeight * scale
  const offsetX = (heroRect.width - renderedWidth) / 2
  const offsetY = (heroRect.height - renderedHeight) / 2

  const sourceX = clamp((sampleRect.x - offsetX) / scale, 0, naturalWidth)
  const sourceY = clamp((sampleRect.y - offsetY) / scale, 0, naturalHeight)
  const sourceWidth = clamp(sampleRect.width / scale, 1, naturalWidth - sourceX)
  const sourceHeight = clamp(sampleRect.height / scale, 1, naturalHeight - sourceY)

  const sampleSize = 64
  canvas.width = sampleSize
  canvas.height = sampleSize
  ctx.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    sampleSize,
    sampleSize
  )

  const { data } = ctx.getImageData(0, 0, sampleSize, sampleSize)

  let luminanceTotal = 0
  let alphaTotal = 0

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3] / 255

    if (alpha <= 0) {
      continue
    }

    const luminance = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
    luminanceTotal += luminance * alpha
    alphaTotal += alpha
  }

  if (alphaTotal === 0) {
    return DEFAULT_TONE
  }

  const averageLuminance = luminanceTotal / alphaTotal
  return averageLuminance > 148 ? 'dark' : 'light'
}

export default function useHeroSearchTone({
  backdrop,
  overrideTone,
  enabled = true,
  targetRef,
}) {
  const [tone, setTone] = useState(DEFAULT_TONE)

  useEffect(() => {
    if (!enabled || !backdrop) {
      setTone(DEFAULT_TONE)
      return
    }

    if (overrideTone === 'dark' || overrideTone === 'light') {
      setTone(overrideTone)
      return
    }

    const src = resolveBackdropSource(backdrop)

    if (!src) {
      setTone(DEFAULT_TONE)
      return
    }

    let isCanceled = false
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.decoding = 'async'

    const updateTone = () => {
      if (isCanceled || !targetRef?.current) {
        return
      }

      const hero = document.querySelector('.hero-feature')

      if (!hero) {
        setTone(DEFAULT_TONE)
        return
      }

      const heroRect = hero.getBoundingClientRect()
      const targetRect = targetRef.current.getBoundingClientRect()

      if (!heroRect.width || !heroRect.height || !targetRect.width || !targetRect.height) {
        setTone(DEFAULT_TONE)
        return
      }

      try {
        const sampleRect = getSampleRect(targetRect, heroRect)
        setTone(sampleSearchTone(image, sampleRect, heroRect))
      } catch {
        setTone(DEFAULT_TONE)
      }
    }

    image.onload = () => {
      updateTone()
    }

    image.onerror = () => {
      if (!isCanceled) {
        setTone(DEFAULT_TONE)
      }
    }

    image.src = src

    const handleResize = () => {
      if (image.complete) {
        updateTone()
      }
    }

    window.addEventListener('resize', handleResize)

    return () => {
      isCanceled = true
      window.removeEventListener('resize', handleResize)
    }
  }, [backdrop, enabled, overrideTone, targetRef])

  return tone
}
