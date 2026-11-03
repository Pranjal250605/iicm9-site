import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { about, convener, fee, reach, site, stats } from '../data/site'
import { Arrow, Magnetic, PageHero, Reveal, SnowCap, SplitText, toast } from '../components/ui'

export default function About() {
  const { hash } = useLocation()
  useEffect(() => {
    if (hash) setTimeout(() => document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth' }), 400)
  }, [hash])
  return (
    <div className="page">
      <PageHero kicker="About" title="IICM 9.0" lead={about.lead} />

      <section className="container about-grid">
        <div className="prose">
          {about.body.map((p, i) => <Reveal key={i} delay={i * 80}><p>{p}</p></Reveal>)}
          <Reveal delay={260}><p className="muted" style={{ fontFamily: 'var(--f-sans)', fontSize: 15 }}>{site.dates} · {site.host}, {site.location}</p></Reveal>
        </div>
        <Reveal className="photo-stack" delay={120}>
          <div className="photo"><img src="/images/campus-snow-hill.webp" alt="IIT Mandi hostels with snow on the hills behind" /></div>
          <div className="photo"><img src="/images/campus-aerial.webp" alt="Aerial view of IIT Mandi's Kamand campus" /></div>
        </Reveal>
      </section>

      <section className="section container">
        <div className="stats-row" style={{ width: '100%' }}>
          {stats.map((s, i) => (
            <Reveal key={s.label} delay={i * 80} className="stat frost">
              <SnowCap seed={i + 2} />
              <div className="stat__value">{s.value}<span>{s.suffix}</span></div>
              <div className="stat__label">{s.label}</div>
            </Reveal>
          ))}
        </div>
        <div className="reach" style={{ marginTop: 12 }}>
          {reach.map((r, i) => (
            <Reveal key={r.label} delay={i * 80} className="stat frost">
              <div className="stat__value">{r.value}</div>
              <div className="stat__label">{r.label}</div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="container">
        <Reveal className="quote frost">
          <div>
            <p className="eyebrow">Convener's message</p>
          </div>
          <blockquote>
            {convener.map((p, i) => <p key={i}>{p}</p>)}
            <cite>Convener, IICM 9.0 · IIT Mandi</cite>
          </blockquote>
        </Reveal>
      </section>

      <section className="section container" id="fee">
        <div className="section-head">
          <div>
            <p className="eyebrow">Registration</p>
            <SplitText as="h2" className="display" text="Registration fee" />
          </div>
        </div>
        <Reveal className="fee frost">
          <div>
            <div className="fee__amt">{fee.amount}</div>
            <div className="fee__note">{fee.note}</div>
          </div>
          <div>
            <p className="eyebrow" style={{ marginBottom: 12 }}>Included</p>
            <ul>{fee.includes.map((x) => <li key={x}>{x}</li>)}</ul>
            <div style={{ marginTop: 24 }}><Magnetic to="/contact" variant="sm">Registration queries <Arrow /></Magnetic></div>
          </div>
        </Reveal>
      </section>

      <section className="container" id="queries">
        <Reveal className="query frost">
          <SnowCap seed={12} />
          <div>
            <p className="eyebrow">Queries</p>
            <h2 className="display">For any query, contact</h2>
          </div>
          <div className="query__body">
            <a className="query__mail" href={`mailto:${site.email}`}>{site.email}</a>
            <p className="muted" style={{ margin: 0 }}>Registration, contingents, events, accommodation, sponsorship or press: write to us and the right team will get back to you.</p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Magnetic href={`mailto:${site.email}`}>Email us <Arrow /></Magnetic>
              <Magnetic
                variant="ghost"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(site.email)
                    toast('Email address copied')
                  } catch {
                    toast(site.email)
                  }
                }}
              >
                Copy address
              </Magnetic>
              <Magnetic to="/contact" variant="ghost">Phone contacts</Magnetic>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  )
}
