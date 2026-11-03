import { contacts, site } from '../data/site'
import { Arrow, Magnetic, PageHero, Reveal, toast } from '../components/ui'

export default function Contact() {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(site.email)
      toast('Email address copied')
    } catch {
      toast(site.email)
    }
  }
  return (
    <div className="page">
      <PageHero kicker="Contact" title="Contact" lead="For contingent queries, sponsorships and press, email us or call one of the coordinators below." />
      <div className="container contact-grid">
        <Reveal className="mail-card frost">
          <p className="eyebrow">Email</p>
          <a className="big" href={`mailto:${site.email}`}>{site.email}</a>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Magnetic href={`mailto:${site.email}`}>Send an email <Arrow /></Magnetic>
            <Magnetic onClick={copy} variant="ghost">Copy address</Magnetic>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 'auto', paddingTop: 12 }}>
            {site.socials.map((s) => <a key={s.label} className="chip" href={s.href} target="_blank" rel="noreferrer">{s.label} ↗</a>)}
          </div>
        </Reveal>
        <div className="people">
          {contacts.map((c, i) => (
            <Reveal key={c.name} delay={i * 80} className="person frost frost--hover">
              <div>
                <h3>{c.name}</h3>
                <p>IICM 9.0 Organising Committee</p>
              </div>
              <Magnetic href={`tel:${c.phone.replace(/\s/g, '')}`} variant="ghost sm" aria-label={`Call ${c.name}`}>{c.phone}</Magnetic>
            </Reveal>
          ))}
        </div>
        <Reveal className="map">
          <iframe title="Map of IIT Mandi, Kamand campus" src={site.mapEmbed} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
        </Reveal>
        <p className="muted" style={{ gridColumn: '1 / -1', margin: 0, fontSize: 14 }}>
          IIT Mandi, Kamand, Himachal Pradesh 175075 · <a href={site.mapLink} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>Open in Google Maps ↗</a>
        </p>
      </div>
    </div>
  )
}
