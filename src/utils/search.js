export function rankByQuery(items, query) {
  const normalizedQuery = query.trim().toLowerCase()

  if (!normalizedQuery) {
    return items
  }

  return [...items]
    .map((item) => {
      const title = item.title.toLowerCase()
      let score = 0

      if (title === normalizedQuery) {
        score += 100
      }

      if (title.startsWith(normalizedQuery)) {
        score += 60
      }

      if (title.includes(normalizedQuery)) {
        score += 40
      }

      normalizedQuery.split(/\s+/).forEach((term) => {
        if (title.startsWith(term)) {
          score += 10
        }

        if (title.includes(term)) {
          score += 5
        }
      })

      score -= Math.abs(title.length - normalizedQuery.length) * 0.2

      return { item, score }
    })
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score)
    .map(({ item }) => item)
}
