import { Link } from 'react-router-dom'
import Journey from '../journey/Journey'
import { venues } from '../data/venues'
import { previousSponsors } from '../data/sponsors'
import { contacts, site } from '../data/site'
import { Arrow, Magnetic, Reveal, SplitText } from '../components/ui'

export default function Home() {
  return (
    <>
      <Journey />

      <section className="section" style={{ paddingBottom: 40 }}>
        <div className="container section-head">
          <div>
            <p className="eyebrow">Kamand campus</p>
            <SplitText as="h2" className="display" text="Venues" />
          </div>
          <Magnetic to="/venues" variant="ghost">All venues <Arrow /></Magnetic>
        </div>
        <div className="venue-strip">
          {venues.map((v, i) => (
            <Reveal key={v.name} delay={i * 60}>
              <Link to="/venues" className="tile">
                <div className="photo" style={{ aspectRatio: '4 / 5' }}><img src={v.image} alt={v.name} loading="lazy" /></div>
                <div className="tile__cap"><h3>{v.name}</h3><span>{String(i + 1).padStart(2, '0')}</span></div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="section" style={{ paddingTop: 40 }}>
        <div className="container section-head">
          <div>
            <p className="eyebrow">Previous editions</p>
            <SplitText as="h2" className="display" text="Past sponsors" />
          </div>
          <Magnetic to="/partners" variant="ghost">Partner with us <Arrow /></Magnetic>
        </div>
        <div className="marquee" aria-label="Previous sponsors">
          <div className="marquee__track">
            {[...previousSponsors, ...previousSponsors].map((s, i) => <span className="marquee__item" key={i} aria-hidden={i >= previousSponsors.length}>{s}</span>)}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container cta-band">
          <Reveal className="cta-band__main frost">
            <p className="eyebrow">Contact</p>
            <h2 className="display">Get in touch</h2>
            <p className="muted" style={{ margin: '0 0 24px', maxWidth: '46ch' }}>
              Email <a href={`mailto:${site.email}`} style={{ color: 'var(--snow)', textDecoration: 'underline' }}>{site.email}</a> or call {contacts.map((c) => c.name).join(', ')}.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Magnetic to="/contact">Contact details <Arrow /></Magnetic>
              <Magnetic href={`mailto:${site.email}`} variant="ghost">Email us</Magnetic>
            </div>
          </Reveal>
          <Reveal delay={120} className="photo">
            <img src="/images/campus-snow-street.webp" alt="IIT Mandi campus after snowfall" loading="lazy" />
          </Reveal>
        </div>
      </section>
    </>
  )
}
