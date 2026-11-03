import { useEffect, useRef, useState } from 'react'

function Digit({ value }: { value: string }) {
  const prev = useRef(value)
  const [flip, setFlip] = useState(false)
  useEffect(() => {
    if (prev.current === value) return
    prev.current = value
    setFlip(true)
    const t = window.setTimeout(() => setFlip(false), 520)
    return () => window.clearTimeout(t)
  }, [value])
  return (
    <span className={`flip ${flip ? 'is-flipping' : ''}`}>
      <span className="flip__face">{value}</span>
    </span>
  )
}

export default function Countdown({ to }: { to: string }) {
  const target = new Date(to).getTime()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])
  const ms = Math.max(0, target - now)
  const parts = [
    ['Days', Math.floor(ms / 864e5)],
    ['Hrs', Math.floor(ms / 36e5) % 24],
    ['Min', Math.floor(ms / 6e4) % 60],
    ['Sec', Math.floor(ms / 1e3) % 60],
  ] as const
  if (ms === 0) return <p className="hero__place">The meet is underway.</p>
  return (
    <div className="countdown" role="timer" aria-label={`${parts[0][1]} days to go`}>
      {parts.map(([label, v]) => (
        <div className="countdown__unit" key={label}>
          <div className="countdown__digits">
            {String(v).padStart(2, '0').split('').map((d, i) => <Digit key={i} value={d} />)}
          </div>
          <span className="countdown__label">{label}</span>
        </div>
      ))}
    </div>
  )
}
