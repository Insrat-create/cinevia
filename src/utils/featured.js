const HERO_EXCLUDED_IDS = new Set(['the-dark-knight'])

function getLocalDateKey() {
  const now = new Date()
  const year = now.getFullYear()
  const month = `${now.getMonth() + 1}`.padStart(2, '0')
  const day = `${now.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function hashString(value) {
  let hash = 0

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }

  return hash
}

function getHeroCandidates(items) {
  const filteredItems = items.filter(
    (item) => item && item.backdrop && !HERO_EXCLUDED_IDS.has(item.id)
  )

  if (filteredItems.length > 0) {
    return filteredItems
  }

  const fallbackItems = items.filter((item) => item && !HERO_EXCLUDED_IDS.has(item.id))
  return fallbackItems.length > 0 ? fallbackItems : items.filter(Boolean)
}

export function getDailyFeaturedItem(items, key = 'default') {
  const candidates = getHeroCandidates(items)

  if (candidates.length === 0) {
    return null
  }

  const dateKey = getLocalDateKey()
  const seed = hashString(`${key}:${dateKey}`)
  return candidates[seed % candidates.length]
}
