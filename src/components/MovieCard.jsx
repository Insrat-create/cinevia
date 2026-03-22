import { Link } from 'react-router-dom'

export default function MovieCard({ movie }) {
  return (
    <Link to={`/watch/${movie.id}`} className="movie-card-link">
      <article className="movie-card">
        <div className="movie-poster-wrap">
          <img src={movie.poster} alt={movie.title} className="movie-poster" />
        </div>

        <div className="movie-info">
          <h3>{movie.title}</h3>
          <p>{movie.genre}</p>
        </div>
      </article>
    </Link>
  )
}