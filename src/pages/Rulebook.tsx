import { useEffect } from 'react'
import { site } from '../data/site'
import { Arrow, Magnetic, PageHero, Reveal } from '../components/ui'

export default function Rulebook() {
  useEffect(() => {
    if (site.rulebookUrl) window.location.replace(site.rulebookUrl)
  }, [])
  return (
    <div className="page">
      <PageHero kicker="Rulebook" title="Rulebook" lead="The IICM 9.0 rulebook will be published here once it is finalised." />
      <div className="container">
        <Reveal style={{ maxWidth: 640 }}>
          <p className="muted" style={{ marginTop: 0 }}>Contingent leaders will also receive it directly from the organising committee. For questions before then, write to the events team.</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 20 }}>
            <Magnetic href={`mailto:${site.email}?subject=IICM%209.0%20rulebook`}>Email the events team <Arrow /></Magnetic>
            <Magnetic to="/events" variant="ghost">See all events</Magnetic>
          </div>
        </Reveal>
      </div>
    </div>
  )
}
