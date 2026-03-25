export function getCatalogType(item) {
  if (!item?.seasons) {
    return 'movie'
  }

  return item.catalogType === 'anime' ? 'anime' : 'tv'
}

export function getCatalogIndexPath(item) {
  const catalogType = getCatalogType(item)

  if (catalogType === 'anime') {
    return '/anime'
  }

  if (catalogType === 'tv') {
    return '/tv-shows'
  }

  return '/movies'
}

export function getDetailPath(item) {
  if (!item) {
    return '/'
  }

  return `${getCatalogIndexPath(item)}/${item.id}`
}
