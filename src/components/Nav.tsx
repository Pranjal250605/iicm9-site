import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { nav, site } from '../data/site'
import NavLights from './NavLights'
import { SnowCap } from './ui'

export default function Nav() {
  const [open, setOpen] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [solid, setSolid] = useState(false)
  const linksRef = useRef<HTMLDivElement>(null)
  const pillRef = useRef<HTMLSpanElement>(null)
  const { pathname } = useLocation()

  useEffect(() => setOpen(false), [pathname])

  useEffect(() => {
    let last = window.scrollY
    const onScroll = () => {
      const y = window.scrollY
      setSolid(y > 40)
      if (Math.abs(y - last) > 6) {
        setHidden(y > last && y > 200)
        last = y
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
  }, [open])

  const movePill = (el: HTMLElement | null) => {
    const pill = pillRef.current
    const wrap = linksRef.current
    if (!pill || !wrap) return
    if (!el) {
      pill.style.opacity = '0'
      return
    }
    const a = el.getBoundingClientRect()
    const b = wrap.getBoundingClientRect()
    pill.style.opacity = '1'
    pill.style.width = `${a.width}px`
    pill.style.transform = `translateX(${a.left - b.left}px)`
  }

  return (
    <>
      <nav className={`nav ${hidden && !open ? 'is-hidden' : ''} ${solid ? 'is-solid' : ''}`} aria-label="Primary">
        <SnowCap seed={6} />
        <NavLights />
        <Link to="/" className="nav__brand" aria-label="IICM 9.0 home">
          <span className="nav__logo"><img src="/images/iit-mandi-logo.png" alt="" width="34" height="34" /></span>
          <span className="nav__name">IICM 9.0<small>IIT MANDI · {site.datesShort}</small></span>
        </Link>
        <div className="nav__links" ref={linksRef} onMouseLeave={() => movePill(null)}>
          <span className="nav__pill" ref={pillRef} />
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => `nav__link ${isActive ? 'is-active' : ''}`} onMouseEnter={(e) => movePill(e.currentTarget)}>
              {n.label}
            </NavLink>
          ))}
        </div>
        <button className={`nav__burger ${open ? 'is-open' : ''}`} aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <span /><span />
        </button>
      </nav>
      <div className={`blizzard ${open ? 'is-open' : ''}`} aria-hidden={!open}>
        {[{ to: '/', label: 'Home' }, ...nav].map((n, i) => (
          <NavLink key={n.to} to={n.to} end style={{ '--i': i } as React.CSSProperties} className={({ isActive }) => (isActive ? 'is-active' : '')} tabIndex={open ? 0 : -1}>
            {n.label}
          </NavLink>
        ))}
        <p className="blizzard__meta">{site.dates} · {site.host}, {site.location}</p>
      </div>
    </>
  )
}
