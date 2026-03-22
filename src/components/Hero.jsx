export default function Hero() {
  return (
    <section className="hero">
      <div className="hero-overlay">
        <p className="hero-tag">Featured</p>
        <h2 className="hero-title">Welcome to Cinevia</h2>
        <p className="hero-description">
          Stream movies and shows with a smooth purple cinematic vibe.
        </p>

        <div className="hero-buttons">
          <button className="btn btn-primary">Watch Now</button>
          <button className="btn btn-secondary">More Info</button>
        </div>
      </div>
    </section>
  )
}