import { useEffect, useRef, useState } from 'react'
import { journey } from '../journey/store'

/**
 * Procedural winter ambience (no audio files): filtered-noise wind that swells with scroll speed,
 * plus fire crackle that fades in near the bonfire square. Muted until the visitor opts in.
 */
export default function Ambience() {
  const [on, setOn] = useState(false)
  const ctxRef = useRef<AudioContext | null>(null)
  const nodes = useRef<{ wind: GainNode; fire: GainNode; master: GainNode; filter: BiquadFilterNode } | null>(null)

  const start = () => {
    const ctx = new AudioContext()
    const master = ctx.createGain()
    master.gain.value = 0
    master.connect(ctx.destination)

    const len = ctx.sampleRate * 4
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    let b = 0
    for (let i = 0; i < len; i++) {
      b = 0.985 * b + 0.015 * (Math.random() * 2 - 1)
      d[i] = b * 6
    }
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.loop = true
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 500
    filter.Q.value = 0.7
    const wind = ctx.createGain()
    wind.gain.value = 0.25
    src.connect(filter).connect(wind).connect(master)
    src.start()

    // crackle: sparse clicks through a highpass
    const cbuf = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate)
    const cd = cbuf.getChannelData(0)
    for (let i = 0; i < cd.length; i++) {
      if (Math.random() < 0.0009) {
        const amp = Math.random() * 0.9
        for (let k = 0; k < 120 && i + k < cd.length; k++) cd[i + k] += (Math.random() * 2 - 1) * amp * Math.exp(-k / 18)
      }
    }
    const csrc = ctx.createBufferSource()
    csrc.buffer = cbuf
    csrc.loop = true
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 900
    const fire = ctx.createGain()
    fire.gain.value = 0
    csrc.connect(hp).connect(fire).connect(master)
    csrc.start()

    master.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 1.5)
    ctxRef.current = ctx
    nodes.current = { wind, fire, master, filter }
  }

  const toggle = () => {
    if (!ctxRef.current) start()
    const ctx = ctxRef.current!
    const n = nodes.current!
    const next = !on
    if (next) ctx.resume()
    n.master.gain.cancelScheduledValues(ctx.currentTime)
    n.master.gain.linearRampToValueAtTime(next ? 0.5 : 0, ctx.currentTime + 0.6)
    setOn(next)
  }

  useEffect(() => {
    if (!on) return
    let raf = 0
    let lastP = journey.progress
    const tick = () => {
      const ctx = ctxRef.current
      const n = nodes.current
      if (ctx && n) {
        const speed = Math.min(1, Math.abs(journey.progress - lastP) * 400)
        lastP = journey.progress
        const p = journey.progress
        const high = p < 0.2 ? 1 : 0.4
        n.wind.gain.setTargetAtTime(0.18 + high * 0.25 + speed * 0.35, ctx.currentTime, 0.3)
        n.filter.frequency.setTargetAtTime(380 + high * 300 + speed * 700, ctx.currentTime, 0.3)
        const near = Math.max(0, 1 - Math.abs(p - 0.79) / 0.09)
        n.fire.gain.setTargetAtTime(near * 0.9, ctx.currentTime, 0.4)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [on])

  useEffect(() => () => void ctxRef.current?.close(), [])

  return (
    <button className={`sound-toggle ${on ? 'is-on' : ''}`} onClick={toggle} aria-pressed={on} aria-label="Toggle ambient sound">
      <span className="sound-toggle__bars" aria-hidden><i /><i /><i /><i /></span>
      {on ? 'Sound on' : 'Sound off'}
    </button>
  )
}
