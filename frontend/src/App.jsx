import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import MapPage from './pages/MapPage'
import PageTransition from './components/PageTransition'
import RouteFlash from './components/RouteFlash'

export default function App() {
  return (
    <BrowserRouter>
      {/* Surgical Top Progress Wipe */}
      <RouteFlash />

      <Navbar />

      <PageTransition>
        <Routes>
          <Route path="/"          element={<Home />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/map"       element={<MapPage />} />
        </Routes>
      </PageTransition>
    </BrowserRouter>
  )
}
