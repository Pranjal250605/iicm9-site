import { useState, type CSSProperties } from 'react'
import { schedule, scheduleTags, type ScheduleTag } from '../data/schedule'
import { PageHero } from '../components/ui'

export default function Schedule() {
  const [day, setDay] = useState(0)
  const [tag, setTag] = useState<ScheduleTag | 'All'>('All')
  const d = schedule[day]
  const slots = d.slots.filter((s) => tag === 'All' || s.tag === tag)
  return (
    <div className="page">
      <PageHero kicker="Schedule" title="Schedule" lead="The meet runs from 25 to 29 December 2026. Timings and venues will be added as they are finalised." />
      <div className="container">
        <p className="notice">Tentative outline, subject to change.</p>
        <div className="days" role="tablist" aria-label="Day">
          <span className="days__ind" style={{ width: `calc((100% - 12px - 24px) / 5)`, transform: `translateX(calc(${day} * (100% + 6px)))` }} aria-hidden />
          {schedule.map((x, i) => (
            <button key={x.label} role="tab" aria-selected={i === day} className={`day-tab ${i === day ? 'is-active' : ''}`} onClick={() => setDay(i)}>
              <b>{x.label}</b>
              <small>{x.date} · {x.weekday.slice(0, 3)}</small>
            </button>
          ))}
        </div>
        <div className="filters">
          {(['All', ...scheduleTags] as const).map((t) => (
            <button key={t} className={`chip ${tag === t ? 'is-active' : ''}`} onClick={() => setTag(t)}>{t}</button>
          ))}
        </div>
        <div className="day-head">
          <h2>{d.theme}</h2>
          <span className="muted">{d.weekday}, {d.date} 2026</span>
        </div>
        <div className="timeline" key={`${day}-${tag}`}>
          {slots.length === 0 && <p className="muted" style={{ padding: '20px 4px' }}>No {tag.toLowerCase()} slots on this day yet.</p>}
          {slots.map((s, i) => (
            <article className="slot" key={s.title} style={{ '--i': i } as CSSProperties}>
              <div className="slot__time">{s.time}</div>
              <div>
                <h3>{s.title}</h3>
                <p>Venue: {s.venue}</p>
              </div>
              <span className="tag" data-tag={s.tag}>{s.tag}</span>
            </article>
          ))}
        </div>
      </div>
    </div>
  )
}
