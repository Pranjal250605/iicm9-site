import { extraVenues, venues } from '../data/venues'
import { PageHero, Reveal } from '../components/ui'

export default function Venues() {
  return (
    <div className="page">
      <PageHero kicker="Venues" title="Venues" lead="Spaces on the Kamand campus that will host IICM 9.0 events. Event-wise venue allocation will be shared with the schedule." />
      <div className="container">
        <div className="venues-grid">
          {venues.map((v, i) => (
            <Reveal key={v.name} delay={(i % 3) * 80} className="tile">
              <div className="photo"><img src={v.image} alt={v.name} loading="lazy" /></div>
              <div className="tile__cap">
                <h3>{v.name}</h3>
                <span>{String(i + 1).padStart(2, '0')}</span>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid var(--line)' }}>
          <p className="eyebrow">Additional venues, if needed</p>
          <div className="filters" style={{ margin: '16px 0 0' }}>
            {extraVenues.map((v) => <span className="chip" key={v}>{v}</span>)}
          </div>
        </Reveal>
      </div>
    </div>
  )
}
