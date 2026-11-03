import { lazy, Suspense, useEffect, useState } from 'react'
import { Route, Routes, useLocation, type Location } from 'react-router-dom'
import Nav from './components/Nav'
import Footer from './components/Footer'
import SnowCursor from './fx/SnowCursor'
import AmbientSnow from './fx/AmbientSnow'
import PageTransition from './fx/PageTransition'
import { scrollToTop, startLenis } from './lib/motion'
import Home from './pages/Home'

const About = lazy(() => import('./pages/About'))
const Events = lazy(() => import('./pages/Events'))
const Schedule = lazy(() => import('./pages/Schedule'))
const Venues = lazy(() => import('./pages/Venues'))
const Team = lazy(() => import('./pages/Team'))
const Partners = lazy(() => import('./pages/Partners'))
const Contact = lazy(() => import('./pages/Contact'))
const Rulebook = lazy(() => import('./pages/Rulebook'))
const NotFound = lazy(() => import('./pages/NotFound'))

const TRANSITION_MS = 520

export default function App() {
  const location = useLocation()
  const [shown, setShown] = useState<Location>(location)
  const [phase, setPhase] = useState<'idle' | 'cover' | 'reveal'>('idle')

  useEffect(() => {
    startLenis()
  }, [])

  useEffect(() => {
    if (location.pathname === shown.pathname) {
      if (location.hash !== shown.hash) setShown(location)
      return
    }
    setPhase('cover')
    const t1 = window.setTimeout(() => {
      setShown(location)
      scrollToTop()
      setPhase('reveal')
    }, TRANSITION_MS)
    const t2 = window.setTimeout(() => setPhase('idle'), TRANSITION_MS * 2 + 80)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [location, shown])

  const isHome = shown.pathname === '/'

  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <Nav />
      {!isHome && <AmbientSnow />}
      <main id="main" className={isHome ? 'main main--home' : 'main'}>
        <Suspense fallback={<div className="page-fallback" />}>
          <Routes location={shown}>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/events" element={<Events />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/venues" element={<Venues />} />
            <Route path="/team" element={<Team />} />
            <Route path="/partners" element={<Partners />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/rulebook" element={<Rulebook />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
      <SnowCursor />
      <PageTransition phase={phase} />
    </>
  )
}
