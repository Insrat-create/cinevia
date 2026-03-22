export default function Navbar() {
  return (
    <header className="navbar">
      <div className="logo-wrap">
        <div className="logo-icon">▶</div>
        <h1 className="logo-text">Cinevia</h1>
      </div>

      <nav className="nav-links">
        <a href="#">Home</a>
        <a href="#">Movies</a>
        <a href="#">TV Shows</a>
        <a href="#">My List</a>
      </nav>
    </header>
  )
}