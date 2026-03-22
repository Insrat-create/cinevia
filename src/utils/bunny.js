export const BUNNY_LIBRARY_ID = '621718'

const thumbnailCache = new Map()
const inflightThumbnailRequests = new Map()

export function getBunnyEmbedUrl(videoId) {
  return `https://iframe.mediadelivery.net/embed/${BUNNY_LIBRARY_ID}/${videoId}`
}

export function getBunnyPlayerUrl(videoId) {
  return `https://player.mediadelivery.net/play/${BUNNY_LIBRARY_ID}/${videoId}`
}

export async function fetchBunnyThumbnailUrl(videoId) {
  if (!videoId) {
    return ''
  }

  if (thumbnailCache.has(videoId)) {
    return thumbnailCache.get(videoId)
  }

  if (inflightThumbnailRequests.has(videoId)) {
    return inflightThumbnailRequests.get(videoId)
  }

  const url = new URL('https://video.bunnycdn.com/OEmbed')
  url.searchParams.set('url', getBunnyEmbedUrl(videoId))

  const request = fetch(url)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Bunny thumbnail lookup failed with status ${response.status}`)
      }

      const payload = await response.json()
      const thumbnailUrl = payload.thumbnail_url ?? ''

      thumbnailCache.set(videoId, thumbnailUrl)
      inflightThumbnailRequests.delete(videoId)

      return thumbnailUrl
    })
    .catch(() => {
      inflightThumbnailRequests.delete(videoId)
      thumbnailCache.set(videoId, '')
      return ''
    })

  inflightThumbnailRequests.set(videoId, request)
  return request
}
