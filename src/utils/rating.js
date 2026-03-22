function parseTenPointRating(source) {
  const rawValue =
    typeof source === 'string' ? source : source?.imdbRating ?? source?.rating ?? ''

  const match = String(rawValue).match(/(\d+(?:\.\d+)?)/)

  if (!match) {
    return null
  }

  const parsed = Number.parseFloat(match[1])

  if (Number.isNaN(parsed)) {
    return null
  }

  return Math.max(0, Math.min(10, parsed))
}

export function getRatingValue(source) {
  const parsed = parseTenPointRating(source)

  if (parsed === null) {
    return ''
  }

  return (parsed / 2).toFixed(1)
}

export function getRoundedRatingValue(source) {
  const ratingValue = getRatingValue(source)

  if (!ratingValue) {
    return null
  }

  return Math.round(Number.parseFloat(ratingValue) * 4) / 4
}
