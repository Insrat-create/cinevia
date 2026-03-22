import { getBunnyEmbedUrl } from '../utils/bunny'

export default function BunnyPlayer({ videoId, title }) {
  if (!videoId) {
    return <p>Video is not available yet.</p>
  }

  const embedUrl = getBunnyEmbedUrl(videoId)

  return (
    <div className="bunny-player-wrap">
      <iframe
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
