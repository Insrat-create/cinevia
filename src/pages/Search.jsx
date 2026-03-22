import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import Topbar from '../components/Topbar'
import SectionRow from '../components/SectionRow'
import movies from '../data/movies'
import tvShows from '../data/tvShows'
import { rankByQuery } from '../utils/search'

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams()
  const inputRef = useRef(null)
  const query = searchParams.get('q') ?? ''
  const normalizedQuery = query.trim().toLowerCase()
  const allResults = rankByQuery([...movies, ...tvShows], normalizedQuery)
  const movieResults = rankByQuery(movies, normalizedQuery)
  const showResults = rankByQuery(tvShows, normalizedQuery)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSearchChange = (event) => {
    const nextValue = event.target.value
    const nextParams = new URLSearchParams(searchParams)

    if (nextValue.trim()) {
      nextParams.set('q', nextValue)
    } else {
      nextParams.delete('q')
    }

    setSearchParams(nextParams, { replace: true })
  }

  return (
    <div className="app-shell">
      <Sidebar />

      <main className="main-shell page-scroll">
        <Topbar showSearch={false} />

        <div className="page-content-stack search-page-stack">
          <section className="search-page-hero">
            <div className="search-page-copy">
              <p className="search-page-kicker">Search</p>
              <h1>Find movies and shows.</h1>
              <p className="search-page-description">
                Jump straight into the catalog with one dedicated search view.
              </p>
            </div>

            <label className="search-page-input-shell" aria-label="Search titles">
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={handleSearchChange}
                className="search-page-input"
                placeholder="Search movies, TV shows, and more"
              />
            </label>
          </section>

          {normalizedQuery ? (
            <>
              <SectionRow title={`Top Matches for "${query}"`} items={allResults} />
              <SectionRow title="Movies" items={movieResults} />
              <SectionRow title="TV Shows" items={showResults} />
            </>
          ) : (
            <>
              <SectionRow title="Popular Movies" items={movies} />
              <SectionRow title="Popular TV Shows" items={tvShows} />
            </>
          )}
        </div>
      </main>
    </div>
  )
}
