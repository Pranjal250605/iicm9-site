import { useEffect, useRef } from 'react'
import { isMobile, prefersReducedMotion } from '../lib/motion'

/** Lightweight 2D snowfall behind inner pages, with depth layers and a cursor "wind". */
export default function AmbientSnow() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current!
    const ctx = canvas.getContext('2d')!
    const dpr = Math.min(window.devicePixelRatio, 1.5)
    const reduced = prefersReducedMotion()
    const N = reduced ? 40 : isMobile() ? 70 : 160
    let w = 0
    let h = 0
    let wind = 0
    let targetWind = 0
    let scrollV = 0
    let lastScroll = window.scrollY
    const flakes = Array.from({ length: N }, () => ({ x: Math.random(), y: Math.random(), z: Math.random(), s: Math.random() * Math.PI * 2 }))
    const resize = () => {
      w = innerWidth
      h = innerHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const onMove = (e: PointerEvent) => {
      targetWind = (e.clientX / w - 0.5) * 1.6
    }
    let raf = 0
    const tick = () => {
      wind += (targetWind - wind) * 0.02
      const sy = window.scrollY
      scrollV += ((sy - lastScroll) - scrollV) * 0.2
      lastScroll = sy
      ctx.clearRect(0, 0, w, h)
      for (const f of flakes) {
        const depth = 0.3 + f.z * 0.7
        f.s += 0.01 + f.z * 0.01
        f.y += (0.35 + depth * 0.9) / h * (reduced ? 0.3 : 1) - (scrollV * 0.15 * depth) / h
        f.x += (Math.sin(f.s) * 0.3 + wind * depth) / w
        if (f.y > 1.02) { f.y = -0.02; f.x = Math.random() }
        if (f.y < -0.03) f.y = 1.01
        if (f.x > 1.02) f.x = -0.02
        if (f.x < -0.02) f.x = 1.02
        ctx.globalAlpha = 0.25 + depth * 0.55
        ctx.fillStyle = '#eaf4ff'
        ctx.beginPath()
        ctx.arc(f.x * w, f.y * h, 0.6 + depth * 2.1, 0, Math.PI * 2)
        ctx.fill()
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    window.addEventListener('resize', resize)
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onMove)
    }
  }, [])
  return (
    <>
      <div className="page-glow" aria-hidden />
      <canvas ref={ref} className="ambient-snow" aria-hidden />
    </>
  )
}
