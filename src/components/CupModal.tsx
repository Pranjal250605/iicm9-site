import { useEffect, useRef, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import type { Cup } from '../data/cups'
import { cups } from '../data/cups'
import { Arrow, Magnetic } from './ui'

export default function CupModal({ cup, onClose }: { cup: Cup; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const n = cups.indexOf(cup) + 1
  useEffect(() => {
    closeRef.current?.focus()
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', key)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', key)
      document.body.style.overflow = ''
    }
  }, [onClose])
  return createPortal(
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="cup-title">
      <div className="modal__scrim" onClick={onClose} />
      <div className="modal__card frost" data-lenis-prevent>
        <button ref={closeRef} className="modal__close" onClick={onClose} aria-label="Close">×</button>
        <p className="eyebrow">Cup {String(n).padStart(2, '0')} of 13 · {cup.category}</p>
        <h2 id="cup-title" className="display">{cup.name}</h2>
        <ul className="event-list">
          {cup.events.map((e, i) => (
            <li key={e} style={{ '--i': i } as CSSProperties}>{e}<span>{String(i + 1).padStart(2, '0')}</span></li>
          ))}
        </ul>
        <p className="muted" style={{ fontSize: 14, margin: 0 }}>Formats, team sizes and timings for each event will be in the rulebook.</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 22 }}>
          <Magnetic to="/rulebook">Rulebook <Arrow /></Magnetic>
          <Magnetic to="/schedule" variant="ghost">Schedule</Magnetic>
        </div>
      </div>
    </div>,
    document.body,
  )
}
