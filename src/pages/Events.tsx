import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { cupCategories, cups, totalEvents } from '../data/cups'
import CupModal from '../components/CupModal'
import { PageHero, Reveal, SnowCap } from '../components/ui'

export default function Events() {
  const { hash } = useLocation()
  const navigate = useNavigate()
  const [cat, setCat] = useState<(typeof cupCategories)[number]>('All')
  const open = cups.find((c) => `#${c.slug}` === hash) ?? null

  useEffect(() => {
    if (open) document.getElementById(`cup-${open.slug}`)?.scrollIntoView({ block: 'center' })
  }, [open])

  const shown = cups.filter((c) => cat === 'All' || c.category === cat)
  return (
    <div className="page">
      <PageHero
        kicker="Events"
        title="13 Cups"
        lead={`${totalEvents} events across the performing, literary, visual and lifestyle arts. Select a cup to see its events.`}
      />
      <div className="container">
        <div className="filters" role="tablist" aria-label="Filter cups">
          {cupCategories.map((c) => (
            <button key={c} role="tab" aria-selected={cat === c} className={`chip ${cat === c ? 'is-active' : ''}`} onClick={() => setCat(c)}>
              {c}
            </button>
          ))}
        </div>
        <div className="cups-grid">
          {shown.map((c, i) => (
            <Reveal key={c.slug} delay={(i % 3) * 70}>
              <button
                id={`cup-${c.slug}`}
                className="cup-tile frost frost--hover"
                onClick={() => navigate({ hash: c.slug }, { replace: true })}
                aria-haspopup="dialog"
              >
                <SnowCap seed={i + 1} />
                <span className="cup-tile__top">
                  <span>{String(cups.indexOf(c) + 1).padStart(2, '0')}</span>
                  <span>{c.category}</span>
                </span>
                <h3>{c.name}</h3>
                <ul>
                  {c.events.slice(0, 3).map((e) => <li key={e}>{e}</li>)}
                  {c.events.length > 3 && <li>+{c.events.length - 3} more</li>}
                </ul>
                <span className="cup-tile__foot">
                  <span>{c.events.length} events</span>
                  <span className="plus" aria-hidden>+</span>
                </span>
              </button>
            </Reveal>
          ))}
        </div>
      </div>
      {open && <CupModal cup={open} onClose={() => navigate({ hash: '' }, { replace: true })} />}
    </div>
  )
}
