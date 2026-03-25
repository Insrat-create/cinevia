export function findEpisodeInShow(show, episodeId) {
  if (!show || !episodeId) {
    return null
  }

  for (const season of show.seasonsData ?? []) {
    for (const episode of season.episodes ?? []) {
      if (episode.id === episodeId) {
        return {
          season,
          episode,
        }
      }
    }
  }

  return null
}

export function findEpisodeMatchInCollections(collections, episodeId) {
  if (!episodeId) {
    return null
  }

  for (const collection of collections) {
    for (const show of collection ?? []) {
      const match = findEpisodeInShow(show, episodeId)

      if (match?.episode) {
        return {
          show,
          ...match,
        }
      }
    }
  }

  return null
}
