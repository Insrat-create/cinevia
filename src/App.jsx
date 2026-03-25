import { useEffect } from 'react'
import { BrowserRouter, Navigate, Routes, Route, useLocation } from 'react-router-dom'
import { AccountProvider } from './context/AccountContext'
import { useAccount } from './context/AccountContext'
import Anime from './pages/Anime'
import AnimeDetail from './pages/AnimeDetail'
import Favorites from './pages/Favorites'
import Home from './pages/Home'
import MovieDetail from './pages/MovieDetail'
import Movies from './pages/Movies'
import ResetPassword from './pages/ResetPassword'
import Search from './pages/Search'
import TVShowDetail from './pages/TVShowDetail'
import TVShows from './pages/TVShows'
import Watch from './pages/Watch'

function ScrollToTop() {
  const location = useLocation()

  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'auto',
    })
  }, [location.pathname])

  return null
}

function AnimeAccessRoute({ children }) {
  const { isAnimeAccessAllowed, isLoading } = useAccount()

  if (isLoading) {
    return null
  }

  if (!isAnimeAccessAllowed) {
    return <Navigate to="/" replace />
  }

  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <AccountProvider>
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/movies" element={<Movies />} />
          <Route path="/movies/:id" element={<MovieDetail />} />
          <Route
            path="/anime"
            element={
              <AnimeAccessRoute>
                <Anime />
              </AnimeAccessRoute>
            }
          />
          <Route
            path="/anime/:id"
            element={
              <AnimeAccessRoute>
                <AnimeDetail />
              </AnimeAccessRoute>
            }
          />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/search" element={<Search />} />
          <Route path="/favorites" element={<Favorites />} />
          <Route path="/tv-shows" element={<TVShows />} />
          <Route path="/tv-shows/:id" element={<TVShowDetail />} />
          <Route path="/watch/:id" element={<Watch />} />
        </Routes>
      </AccountProvider>
    </BrowserRouter>
  )
}
