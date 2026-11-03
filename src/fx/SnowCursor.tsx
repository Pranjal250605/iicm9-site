import { useEffect, useRef } from 'react'
import { isTouch, prefersReducedMotion } from '../lib/motion'

type P = { x: number; y: number; vx: number; vy: number; life: number; max: number; r: number; rot: number; vr: number; flake: boolean }

/** Frosty sparkles trailing the cursor + a snowflake burst on every click. */
export default function SnowCursor() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (prefersReducedMotion()) return
    const canvas = ref.current!
    const ctx = canvas.getContext('2d')!
    const dpr = Math.min(window.devicePixelRatio, 2)
    const parts: P[] = []
    let raf = 0
    let lastX = -1
    let lastY = -1
    const touch = isTouch()

    const resize = () => {
      canvas.width = innerWidth * dpr
      canvas.height = innerHeight * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()

    const spawn = (x: number, y: number, n: number, burst: boolean) => {
      for (let i = 0; i < n; i++) {
        const a = burst ? (i / n) * Math.PI * 2 + Math.random() * 0.4 : Math.random() * Math.PI * 2
        const sp = burst ? 2.2 + Math.random() * 3 : 0.2 + Math.random() * 0.6
        parts.push({
          x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (burst ? 0.5 : 0),
          life: 0, max: burst ? 55 + Math.random() * 30 : 40 + Math.random() * 30,
          r: burst ? 5 + Math.random() * 4 : 1 + Math.random() * 1.8,
          rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.15, flake: burst && Math.random() > 0.25,
        })
      }
      if (!raf) raf = requestAnimationFrame(tick)
    }

    const flake = (p: P, alpha: number) => {
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      ctx.strokeStyle = `rgba(235,245,255,${alpha})`
      ctx.lineWidth = 1.3
      ctx.beginPath()
      for (let k = 0; k < 6; k++) {
        ctx.rotate(Math.PI / 3)
        ctx.moveTo(0, 0)
        ctx.lineTo(0, -p.r)
        ctx.moveTo(0, -p.r * 0.55)
        ctx.lineTo(-p.r * 0.28, -p.r * 0.8)
        ctx.moveTo(0, -p.r * 0.55)
        ctx.lineTo(p.r * 0.28, -p.r * 0.8)
      }
      ctx.stroke()
      ctx.restore()
    }

    const tick = () => {
      ctx.clearRect(0, 0, innerWidth, innerHeight)
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]
        p.life++
        p.vy += 0.035
        p.vx *= 0.97
        p.vy *= 0.97
        p.x += p.vx + Math.sin((p.life + i) * 0.08) * 0.25
        p.y += p.vy
        p.rot += p.vr
        const t = p.life / p.max
        const alpha = (1 - t) * 0.9
        if (p.flake) flake(p, alpha)
        else {
          ctx.fillStyle = `rgba(220,238,255,${alpha})`
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.r * (1 - t * 0.5), 0, Math.PI * 2)
          ctx.fill()
        }
        if (p.life >= p.max) parts.splice(i, 1)
      }
      raf = parts.length ? requestAnimationFrame(tick) : 0
    }

    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      if (lastX >= 0) {
        const d = Math.hypot(e.clientX - lastX, e.clientY - lastY)
        if (d > 6) spawn(e.clientX, e.clientY, Math.min(3, Math.floor(d / 10) + 1), false)
      }
      lastX = e.clientX
      lastY = e.clientY
    }
    const down = (e: PointerEvent) => spawn(e.clientX, e.clientY, touch ? 8 : 12, true)

    if (!touch) window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('pointerdown', down, { passive: true })
    window.addEventListener('resize', resize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerdown', down)
      window.removeEventListener('resize', resize)
    }
  }, [])
  return <canvas ref={ref} className="fx-canvas" aria-hidden />
}
