import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { isTouch, prefersReducedMotion } from '../lib/motion'

const COLORS = ['#ffd27a', '#ff7a5c', '#8fd3ff', '#7be0a6', '#ff9ec4', '#fff1d6']
const SAG = 13

type Bulb = { x: number; y: number; a: number; c: string; d: number; dur: number }

/**
 * Festoon of Christmas lights hanging under the nav bar.
 * Bulbs twinkle out of sync, brighten near the cursor, run a chase when the bar is hovered,
 * and swing when brushed.
 */
export default function NavLights() {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const { path, bulbs } = useMemo(() => {
    if (!w) return { path: '', bulbs: [] as Bulb[] }
    const spans = Math.max(2, Math.round(w / 170))
    const seg = w / spans
    const per = Math.max(3, Math.round(seg / 30))
    let d = 'M0 0'
    const out: Bulb[] = []
    for (let i = 0; i < spans; i++) {
      d += ` Q${i * seg + seg / 2} ${SAG * 2} ${(i + 1) * seg} 0`
      for (let k = 0; k < per; k++) {
        const t = (k + 0.5) / per
        const idx = i * per + k
        out.push({
          x: i * seg + t * seg,
          y: SAG * 4 * t * (1 - t),
          a: (Math.atan((SAG * 4 * (1 - 2 * t)) / seg) * 180) / Math.PI,
          c: COLORS[idx % COLORS.length],
          d: ((idx * 37) % 23) / 10,
          dur: 1.8 + ((idx * 13) % 10) / 5,
        })
      }
    }
    return { path: d, bulbs: out }
  }, [w])

  // bulbs near the cursor glow brighter
  useEffect(() => {
    if (isTouch() || prefersReducedMotion()) return
    const host = ref.current
    if (!host) return
    let raf = 0
    let px = -1e4
    let py = -1e4
    const apply = () => {
      raf = 0
      const r = host.getBoundingClientRect()
      const vy = Math.max(0, 1 - Math.max(0, py - r.top - 20) / 90)
      host.querySelectorAll<HTMLElement>('.nl-bulb').forEach((b) => {
        const bx = r.left + parseFloat(b.style.left)
        const near = Math.max(0, 1 - Math.abs(px - bx) / 120) * vy
        b.style.setProperty('--near', near.toFixed(2))
      })
    }
    const move = (e: PointerEvent) => {
      px = e.clientX
      py = e.clientY
      if (!raf) raf = requestAnimationFrame(apply)
    }
    window.addEventListener('pointermove', move, { passive: true })
    return () => {
      window.removeEventListener('pointermove', move)
      cancelAnimationFrame(raf)
    }
  }, [bulbs])

  const swing = (e: React.PointerEvent<HTMLSpanElement>) => {
    const el = e.currentTarget
    if (el.classList.contains('is-swing')) return
    el.classList.add('is-swing')
    window.setTimeout(() => el.classList.remove('is-swing'), 1500)
  }

  return (
    <div className="nav-lights" ref={ref} aria-hidden>
      {w > 0 && (
        <svg width={w} height={SAG * 2 + 4} viewBox={`0 0 ${w} ${SAG * 2 + 4}`}>
          <path d={path} className="nav-lights__wire" />
        </svg>
      )}
      {bulbs.map((b, i) => (
        <span
          key={i}
          className="nl-bulb"
          onPointerEnter={swing}
          style={{ left: `${b.x}px`, top: `${b.y}px`, '--c': b.c, '--d': `${b.d}s`, '--dur': `${b.dur}s`, '--a': `${b.a}deg`, '--i': i } as CSSProperties}
        />
      ))}
    </div>
  )
}
