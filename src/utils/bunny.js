export const BUNNY_LIBRARY_ID = '621718'

const thumbnailCache = new Map()
const inflightThumbnailRequests = new Map()
const playbackInfoCache = new Map()
const inflightPlaybackRequests = new Map()

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

export async function fetchBunnyPlaybackInfo(videoId) {
  if (!videoId) {
    return null
  }

  if (playbackInfoCache.has(videoId)) {
    return playbackInfoCache.get(videoId)
  }

  if (inflightPlaybackRequests.has(videoId)) {
    return inflightPlaybackRequests.get(videoId)
  }

  const url = new URL('https://video.bunnycdn.com/OEmbed')
  url.searchParams.set('url', getBunnyEmbedUrl(videoId))

  const request = fetch(url)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Bunny playback lookup failed with status ${response.status}`)
      }

      const payload = await response.json()
      const thumbnailUrl = payload.thumbnail_url ?? ''

      if (!thumbnailUrl) {
        throw new Error('Bunny playback lookup did not return a thumbnail URL')
      }

      const thumbnail = new URL(thumbnailUrl)
      const basePath = thumbnail.pathname.replace(/\/thumbnail\.jpg$/i, '')
      const baseUrl = `${thumbnail.origin}${basePath}`
      const playbackInfo = {
        baseUrl,
        hlsUrl: `${baseUrl}/playlist.m3u8`,
        posterUrl: thumbnailUrl,
        mp4Url: `${baseUrl}/play_720p.mp4`,
        originalUrl: `${baseUrl}/original`,
      }

      thumbnailCache.set(videoId, thumbnailUrl)
      playbackInfoCache.set(videoId, playbackInfo)
      inflightThumbnailRequests.delete(videoId)
      inflightPlaybackRequests.delete(videoId)

      return playbackInfo
    })
    .catch(() => {
      inflightPlaybackRequests.delete(videoId)
      playbackInfoCache.set(videoId, null)
      return null
    })

  inflightPlaybackRequests.set(videoId, request)
  return request
}
