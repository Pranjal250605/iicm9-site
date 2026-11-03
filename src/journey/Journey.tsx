import { lazy, Suspense, useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { cups, totalEvents } from '../data/cups'
import { nights } from '../data/nights'
import { about, fee, site, stats } from '../data/site'
import Countdown from '../components/Countdown'
import { Arrow, Magnetic, SnowCap, Snowflake } from '../components/ui'
import Ambience from '../fx/Ambience'
import { clamp, isMobile, prefersReducedMotion, scrollToY, smoothstep, webglAvailable, window4 } from '../lib/motion'
import { CHAPTERS, cupIndexAt, cupProgress, journey, type ChapterKey } from './store'

const Scene = lazy(() => import('../three/Scene'))

const TRACK_VH = 1100

function useModelUrl(enabled: boolean) {
  const [state, setState] = useState<{ url: string | null; pct: number }>({ url: null, pct: 0 })
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    let objectUrl = ''
    ;(async () => {
      try {
        const res = await fetch('/models/village.glb')
        const total = Number(res.headers.get('content-length')) || 720_000
        const reader = res.body!.getReader()
        const chunks: Uint8Array[] = []
        let got = 0
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          chunks.push(value)
          got += value.length
          if (!cancelled) setState((s) => ({ ...s, pct: Math.min(0.95, got / total) }))
        }
        objectUrl = URL.createObjectURL(new Blob(chunks as BlobPart[], { type: 'model/gltf-binary' }))
        // signs are painted onto canvases, so the display fonts must be ready first
        await Promise.race([
          Promise.all([document.fonts.load('64px "Anton"'), document.fonts.load('italic 40px "Gelasio"')]),
          new Promise((r) => setTimeout(r, 2500)),
        ])
        if (!cancelled) setState({ url: objectUrl, pct: 0.95 })
      } catch {
        if (!cancelled) setState({ url: '/models/village.glb', pct: 0.95 })
      }
    })()
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [enabled])
  return state
}

function Stat({ value, suffix, label, play }: { value: number; suffix: string; label: string; play: boolean }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!play) return
    let raf = 0
    const t0 = performance.now()
    const tick = (t: number) => {
      const k = clamp((t - t0) / 1400)
      setN(Math.round(value * (1 - Math.pow(1 - k, 3))))
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [play, value])
  return (
    <div className="stat frost">
      <SnowCap seed={value} />
      <div className="stat__value">{n}<span>{suffix}</span></div>
      <div className="stat__label">{label}</div>
    </div>
  )
}

export default function Journey() {
  const trackRef = useRef<HTMLDivElement>(null)
  const chapterRefs = useRef<Partial<Record<ChapterKey, HTMLDivElement | null>>>({})
  const fadeRef = useRef<HTMLDivElement>(null)
  const mistRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const nightsRef = useRef<HTMLDivElement>(null)
  const nightsHeadRef = useRef<HTMLDivElement>(null)
  const [gl] = useState(() => webglAvailable())
  const [mobile] = useState(() => isMobile())
  const [reduced] = useState(() => prefersReducedMotion())
  const [cup, setCup] = useState(0)
  const [live, setLive] = useState<ChapterKey>('hero')
  const [ready, setReady] = useState(!gl)
  const [loaderGone, setLoaderGone] = useState(!gl)
  const model = useModelUrl(gl)

  useEffect(() => {
    journey.reduced = reduced
  }, [reduced])

  // never let a slow GPU / decoder trap visitors behind the loader
  useEffect(() => {
    if (!gl) return
    const t = window.setTimeout(() => setReady(true), model.url ? 7000 : 15000)
    return () => window.clearTimeout(t)
  }, [gl, model.url])

  useEffect(() => {
    if (!ready) return
    const t = window.setTimeout(() => setLoaderGone(true), 900)
    return () => window.clearTimeout(t)
  }, [ready])

  // scroll → target progress; rAF → damped progress → overlay styles
  useEffect(() => {
    let raf = 0
    let lastCup = -2
    let lastLive: ChapterKey | '' = ''
    const measure = () => {
      const el = trackRef.current
      if (!el) return
      const top = el.getBoundingClientRect().top + window.scrollY
      const span = el.offsetHeight - window.innerHeight
      if (span <= 0) return
      journey.target = clamp((window.scrollY - top) / span)
    }
    const onPointer = (e: PointerEvent) => {
      journey.pointer.x = (e.clientX / window.innerWidth) * 2 - 1
      journey.pointer.y = (e.clientY / window.innerHeight) * 2 - 1
    }
    const tick = () => {
      measure()
      const k = reduced ? 1 : 0.12
      journey.progress += (journey.target - journey.progress) * k
      if (!Number.isFinite(journey.progress)) journey.progress = journey.target
      if (Math.abs(journey.target - journey.progress) < 1e-5) journey.progress = journey.target
      const p = journey.progress

      let best: ChapterKey = 'hero'
      let bestO = -1
      for (const key of Object.keys(CHAPTERS) as ChapterKey[]) {
        const [a, b, c, d] = CHAPTERS[key]
        const o = window4(a, b, c, d, p)
        const el = chapterRefs.current[key]
        if (el) {
          el.style.opacity = String(o)
          const dir = p < (b + c) / 2 ? 1 : -1
          el.style.transform = reduced ? '' : `translate3d(0, ${(1 - o) * 40 * dir}px, 0)`
          el.style.visibility = o < 0.01 ? 'hidden' : 'visible'
        }
        if (o > bestO) {
          bestO = o
          best = key
        }
      }
      if (best !== lastLive) {
        lastLive = best
        setLive(best)
      }
      const ci = cupIndexAt(p)
      if (ci !== lastCup && ci >= 0) {
        lastCup = ci
        setCup(ci)
      }
      if (fadeRef.current) fadeRef.current.style.opacity = String(smoothstep(0.965, 1, p))
      if (mistRef.current) mistRef.current.style.opacity = String(window4(0.05, 0.1, 0.12, 0.17, p) * 0.85)
      if (barRef.current) barRef.current.style.transform = `scaleX(${p})`
      if (!reduced) {
        // depth drift: overlay pieces slide at different rates while their chapter is on screen
        for (const key of Object.keys(CHAPTERS) as ChapterKey[]) {
          const el = chapterRefs.current[key]
          if (!el || el.style.visibility === 'hidden') continue
          const [a, , , d] = CHAPTERS[key]
          const start = Math.max(0, a)
          const lp = clamp((p - start) / (d - start))
          el.querySelectorAll<HTMLElement>('[data-drift]').forEach((n) => {
            const amt = Number(n.dataset.drift)
            const from = n.dataset.driftFrom ? Number(n.dataset.driftFrom) : 0.5
            n.style.transform = `translate3d(0, ${(from - lp) * amt}px, 0)`
          })
        }
        // nights: the card row pans sideways with scroll; cards rise in one after another
        const track = nightsRef.current
        if (track) {
          const [a, , , d] = CHAPTERS.nights
          const lp = clamp((p - a) / (d - a))
          const e = lp < 0.5 ? 2 * lp * lp : 1 - Math.pow(-2 * lp + 2, 2) / 2
          const vw = window.innerWidth
          const overflow = Math.max(0, track.scrollWidth - vw)
          track.style.transform = `translate3d(${vw * 0.45 * (1 - e) - overflow * e}px, 0, 0)`
          Array.from(track.children).forEach((child, i) => {
            const k = clamp(lp * 2.4 - i * 0.16)
            const t = 1 - (1 - Math.pow(1 - k, 3))
            const card = child as HTMLElement
            card.style.transform = `translate3d(0, ${t * 90}px, 0) rotate(${t * 5}deg)`
            card.style.opacity = String(0.15 + 0.85 * (1 - t))
            const img = card.querySelector('img')
            if (img) img.style.transform = `scale(1.18) translate3d(${(0.5 - lp) * 40}px, 0, 0)`
          })
          if (nightsHeadRef.current) nightsHeadRef.current.style.transform = `translate3d(${(0.35 - lp) * 120}px, 0, 0)`
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    window.addEventListener('pointermove', onPointer, { passive: true })
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onPointer)
      journey.progress = journey.target = 0
    }
  }, [reduced])

  const goTo = useCallback((p: number) => {
    const el = trackRef.current
    if (!el) return
    const top = el.getBoundingClientRect().top + window.scrollY
    scrollToY(top + p * (el.offsetHeight - window.innerHeight) + 2)
  }, [])

  const onReady = useCallback(() => setReady(true), [])
  const c = cups[cup]
  const pct = ready ? 1 : model.pct
  const set = (key: ChapterKey) => (el: HTMLDivElement | null) => {
    chapterRefs.current[key] = el
  }

  return (
    <div className="journey" ref={trackRef} style={{ height: `${TRACK_VH}vh` }}>
      <div className="progress-bar" ref={barRef} aria-hidden />
      <div className="journey__stage">
        <div className="journey__canvas" aria-hidden>
          {gl && model.url ? (
            <Suspense fallback={null}>
              <Scene url={model.url} mobile={mobile} onReady={onReady} />
            </Suspense>
          ) : !gl ? (
            <div className="journey__fallback" style={{ backgroundImage: 'url(/images/concept-village.webp)' }} />
          ) : null}
        </div>
        <div className="journey__shade" aria-hidden />
        <div ref={mistRef} aria-hidden style={{ position: 'absolute', inset: 0, background: 'radial-gradient(80% 60% at 50% 50%, rgba(220,232,250,.85), rgba(170,195,230,.6))', opacity: 0, pointerEvents: 'none' }} />

        {/* 0 · hero */}
        <section ref={set('hero')} className={`chapter hero ${live === 'hero' ? 'is-live' : ''}`} aria-label="Inter IIT Cultural Meet 9.0">
          <p className="eyebrow">IIT Mandi · Ninth edition</p>
          <h1 className="display display--wide hero__title" data-drift="-160" data-drift-from="0">
            Inter IIT<br />Cult Meet<br /><span className="accent">9.0</span>
          </h1>
          <div className="hero__foot">
            <div className="hero__when">
              <span className="rule" />
              <p className="hero__date">{site.datesShort}</p>
              <p className="hero__place">IIT Mandi, Kamand, Himachal Pradesh</p>
            </div>
            <div className="hero__count">
              <p className="eyebrow">Begins in</p>
              <Countdown to={site.startsAt} />
            </div>
          </div>
          <button className="scroll-cue" onClick={() => goTo(0.12)} aria-label="Scroll down">
            Scroll
            <span className="scroll-cue__line" />
          </button>
        </section>

        {/* 1 · intro */}
        <section ref={set('intro')} className={`chapter chapter--split ${live === 'intro' ? 'is-live' : ''}`} aria-label="About">
          <div className="chapter__panel frost" data-drift="90">
            <p className="eyebrow">About the meet</p>
            <h2 className="display">IIT Mandi hosts the meet for the first time</h2>
            <div className="prose">
              <p>{about.body[0]}</p>
            </div>
            <Magnetic to="/about" variant="ghost sm">About IICM 9.0 <Arrow /></Magnetic>
          </div>
        </section>

        {/* 2 · gate */}
        <section ref={set('gate')} className={`chapter chapter--gate ${live === 'gate' ? 'is-live' : ''}`} aria-label="At a glance">
          <div className="stats-row">
            {stats.map((s, i) => <div key={s.label} data-drift={40 + i * 35}><Stat {...s} play={live === 'gate'} /></div>)}
          </div>
        </section>

        {/* 3 · the cups street */}
        <section ref={set('cups')} className={`chapter chapter--cups ${live === 'cups' ? 'is-live' : ''}`} aria-label="The 13 cups" style={{ paddingTop: 'var(--nav-h)' }}>
          <div className="cups-head" data-drift="70">
            <p className="eyebrow">Events</p>
            <h2 className="display">13 cups, {totalEvents} events</h2>
          </div>
          <article className="cup-card frost" key={c.slug}>
            <SnowCap seed={cup + 1} />
            <div className="cup-card__swap">
              <p className="eyebrow">Cup {String(cup + 1).padStart(2, '0')} of 13 · {c.category}</p>
              <h3 className="display">{c.name}</h3>
              <ul>{c.events.map((e, i) => <li key={e}>{e}<span>{String(i + 1).padStart(2, '0')}</span></li>)}</ul>
              <p className="cup-card__count">{c.events.join(' · ')}</p>
              <Magnetic to={`/events#${c.slug}`} variant="sm">Event details <Arrow /></Magnetic>
            </div>
          </article>
          <nav className="cup-rail" aria-label="Jump to cup">
            {cups.map((x, i) => (
              <button key={x.slug} className={i === cup ? 'is-active' : ''} onClick={() => goTo(cupProgress(i))} aria-label={`Go to ${x.name}`}>
                {x.short}
              </button>
            ))}
          </nav>
        </section>

        {/* 4 · nights at the square */}
        <section ref={set('nights')} className={`chapter chapter--nights ${live === 'nights' ? 'is-live' : ''}`} aria-label="Pro nights">
          <div className="head" ref={nightsHeadRef}>
            <p className="eyebrow">Pro nights and more</p>
            <h2 className="display">What to look forward to</h2>
          </div>
          <div className="nights" ref={nightsRef}>
            {nights.map((n, i) => (
              <div className="night-wrap" key={n.name}>
              <article className="night frost frost--hover">
                <div className="photo"><img src={n.image} alt={n.name} loading="lazy" /></div>
                <div className="night__body">
                  <h3>{n.name}</h3>
                  <span>{String(i + 1).padStart(2, '0')}</span>
                </div>
              </article>
              </div>
            ))}
          </div>
        </section>

        {/* 5 · finale */}
        <section ref={set('finale')} className={`chapter chapter--finale ${live === 'finale' ? 'is-live' : ''}`} aria-label="Registration">
          <p className="eyebrow">See you in Kamand</p>
          <h2 className="display display--wide" data-drift="110">25–29<br />December</h2>
          <div className="fee-card frost" data-drift="60">
            <div>
              <div className="fee-card__amt">{fee.amount}</div>
              <div className="fee-card__note">{fee.note}</div>
            </div>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--muted)' }}>
              Covers accommodation, mess, transport, merchandise and an amenity kit. <Link to="/about#fee" style={{ color: 'var(--snow)', textDecoration: 'underline' }}>Details</Link>
            </p>
          </div>
          <div className="finale__row" data-drift="40">
            <Magnetic to="/schedule" variant="ember">Schedule <Arrow /></Magnetic>
            <Magnetic to="/rulebook" variant="ghost">Rulebook</Magnetic>
            <Magnetic to="/contact" variant="ghost">Contact</Magnetic>
          </div>
        </section>

        <div className="journey__fade" ref={fadeRef} aria-hidden />
        {gl && <Ambience />}
      </div>

      {gl && createPortal(
        <div className={`loader ${loaderGone ? 'is-done' : ''}`} aria-hidden={loaderGone} role="status">
          <div className="loader__inner" style={{ '--p': pct } as CSSProperties}>
            <Snowflake />
            <div className="loader__bar"><i /></div>
            <div className="loader__label">IICM 9.0 · Loading</div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
