function toNumber(value) {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function getYear(item) {
  return Number.parseInt(item.year, 10) || 0
}

function getRating(item) {
  return toNumber(item.rating ?? item.imdbRating)
}

function getReleaseDate(item) {
  if (!item.released) {
    return null
  }

  const timestamp = Date.parse(item.released)

  if (Number.isNaN(timestamp)) {
    return null
  }

  return new Date(timestamp)
}

function getReleaseTimestamp(item) {
  return getReleaseDate(item)?.getTime() ?? 0
}

function getSeasonCount(item) {
  return Number.parseInt(item.seasonsCount ?? item.seasons, 10) || 0
}

function getEpisodeCount(item) {
  return Number.parseInt(item.totalEpisodes, 10) || 0
}

function getGenres(item) {
  const values =
    Array.isArray(item.genres) && item.genres.length > 0
      ? item.genres
      : [item.genre, item.badge].filter(Boolean)

  return values.map((genre) => genre.toLowerCase())
}

function includesAnyGenre(item, genres) {
  const itemGenres = getGenres(item)
  return genres.some((genre) => itemGenres.includes(genre.toLowerCase()))
}

function sortItems(items, scoreItem) {
  return [...items].sort((left, right) => {
    const scoreDifference = scoreItem(right) - scoreItem(left)

    if (scoreDifference !== 0) {
      return scoreDifference
    }

    const yearDifference = getYear(right) - getYear(left)

    if (yearDifference !== 0) {
      return yearDifference
    }

    return left.title.localeCompare(right.title)
  })
}

function dedupeRows(rows) {
  const seen = new Set()

  return rows.filter((row) => {
    if (!row.items || row.items.length === 0) {
      return false
    }

    const signature = row.items.map((item) => item.id).join('|')

    if (seen.has(signature)) {
      return false
    }

    seen.add(signature)
    return true
  })
}

export function getMovieRows(items) {
  const now = new Date()
  const recentWindowStart = new Date(now)
  recentWindowStart.setDate(recentWindowStart.getDate() - 120)

  const recentReleases = items.filter((item) => {
    const releasedAt = getReleaseDate(item)

    if (!releasedAt) {
      return false
    }

    return releasedAt <= now && releasedAt >= recentWindowStart
  })

  return dedupeRows([
    {
      title: 'Popular Movies',
      items: sortItems(items, (item) => getRating(item) * 10 + getYear(item) * 0.06),
    },
    {
      title: 'Recent Releases',
      items: sortItems(recentReleases, (item) => getReleaseTimestamp(item)),
    },
    {
      title: 'Animated & Family',
      items: sortItems(
        items.filter((item) => includesAnyGenre(item, ['Animation', 'Family'])),
        (item) => getRating(item) * 10 + getYear(item) * 0.02
      ),
    },
    {
      title: 'Sci-Fi Adventures',
      items: sortItems(
        items.filter((item) => includesAnyGenre(item, ['Sci-Fi', 'Fantasy'])),
        (item) => getRating(item) * 10 + getYear(item) * 0.04
      ),
    },
    {
      title: 'Thrills After Dark',
      items: sortItems(
        items.filter((item) => includesAnyGenre(item, ['Horror', 'Crime', 'Thriller'])),
        (item) => getYear(item) * 10 + getRating(item)
      ),
    },
  ])
}

export function getTvRows(items) {
  return dedupeRows([
    {
      title: 'Popular TV Shows',
      items: sortItems(
        items,
        (item) => getRating(item) * 10 + getSeasonCount(item) * 2 + getEpisodeCount(item) * 0.05
      ),
    },
    {
      title: 'Animation & Comedy',
      items: sortItems(
        items.filter((item) =>
          includesAnyGenre(item, ['Animation', 'Comedy', 'Adult Animation', 'Crude Humor'])
        ),
        (item) => getRating(item) * 10 + getEpisodeCount(item) * 0.1
      ),
    },
    {
      title: 'Adventure & Sci-Fi',
      items: sortItems(
        items.filter((item) => includesAnyGenre(item, ['Adventure', 'Sci-Fi', 'Fantasy'])),
        (item) => getRating(item) * 10 + getSeasonCount(item)
      ),
    },
    {
      title: 'Long Running Series',
      items: sortItems(
        items.filter((item) => getEpisodeCount(item) > 0),
        (item) => getEpisodeCount(item) + getSeasonCount(item) * 5 + getRating(item)
      ),
    },
  ])
}

export function getHomeRows(movies, shows) {
  const movieRows = getMovieRows(movies)
  const popularMovies = movieRows[0]?.items ?? []
  const recentMovies = movieRows.find((row) => row.title === 'Recent Releases')?.items ?? []
  const lateNightMovies = movieRows.find((row) => row.title === 'Thrills After Dark')?.items ?? []
  const familyMovies = movieRows.find((row) => row.title === 'Animated & Family')?.items ?? []
  const tvRows = getTvRows(shows)

  return dedupeRows([
    {
      title: 'Trending Movies',
      items: popularMovies,
    },
    {
      title: 'New Releases',
      items: recentMovies,
    },
    {
      title: 'Late Night Picks',
      items: lateNightMovies,
    },
    {
      title: 'Family Favorites',
      items: familyMovies,
    },
    {
      title: 'Top TV Shows',
      items: tvRows[0]?.items ?? [],
      getItemHref: (item) => `/tv-shows/${item.id}`,
    },
  ])
}
