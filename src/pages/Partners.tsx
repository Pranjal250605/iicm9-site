import { partnerSlots } from '../data/sponsors'
import { site } from '../data/site'
import { Arrow, Magnetic, PageHero, Reveal, SplitText } from '../components/ui'

export default function Partners() {
  return (
    <div className="page">
      <PageHero
        kicker="Partners"
        title="Partners"
        lead="Partnerships for IICM 9.0 are open. The meet brings together 23 IITs and an expected footfall of over 5,000 across five days."
      />
      <div className="container">
        <div className="slots">
          {partnerSlots.map((s, i) => (
            <Reveal key={s.tier} delay={i * 60} className="pslot frost">
              <span className="pslot__tier">{s.tier}</span>
              {s.logo ? <img src={s.logo} alt={s.name} style={{ maxHeight: 60, objectFit: 'contain' }} /> : <span className="pslot__name">{s.name ?? 'To be announced'}</span>}
            </Reveal>
          ))}
        </div>

        <section className="section" style={{ paddingBottom: 0 }}>
          <div className="section-head">
            <div>
              <p className="eyebrow">Previous editions</p>
              <SplitText as="h2" className="display" text="Past sponsors" />
            </div>
            <Magnetic href={`mailto:${site.email}?subject=Partnering%20with%20IICM%209.0`}>Partner with us <Arrow /></Magnetic>
          </div>
          <Reveal className="sponsor-wall">
            <img src="/images/sponsors-previous.webp" alt="Logos of previous sponsors including RSPL, Hindustan Times, GeeksforGeeks, Pepsi, Samsung, SBI and ICICI Bank" loading="lazy" />
          </Reveal>
        </section>
      </div>
    </div>
  )
}
