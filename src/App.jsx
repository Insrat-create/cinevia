import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AccountProvider } from './context/AccountContext'
import Favorites from './pages/Favorites'
import Home from './pages/Home'
import MovieDetail from './pages/MovieDetail'
import Movies from './pages/Movies'
import ResetPassword from './pages/ResetPassword'
import Search from './pages/Search'
import TVShowDetail from './pages/TVShowDetail'
import TVShows from './pages/TVShows'
import Watch from './pages/Watch'

export default function App() {
  return (
    <BrowserRouter>
      <AccountProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/movies" element={<Movies />} />
          <Route path="/movies/:id" element={<MovieDetail />} />
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
