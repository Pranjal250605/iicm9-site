import { Link } from 'react-router-dom'
import { contacts, nav, site } from '../data/site'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__grid">
          <div>
            <h4>Inter IIT Cultural Meet 9.0</h4>
            <p className="muted" style={{ margin: 0, maxWidth: 340 }}>
              Hosted by IIT Mandi, {site.location}. {site.dates}.
            </p>
            <p style={{ margin: '16px 0 0' }}><a href={`mailto:${site.email}`}>{site.email}</a></p>
          </div>
          <div>
            <h4>Explore</h4>
            <ul>{nav.slice(0, 4).map((n) => <li key={n.to}><Link to={n.to}>{n.label}</Link></li>)}</ul>
          </div>
          <div>
            <h4>More</h4>
            <ul>{nav.slice(4).map((n) => <li key={n.to}><Link to={n.to}>{n.label}</Link></li>)}</ul>
          </div>
          <div>
            <h4>Reach us</h4>
            <ul>
              {contacts.map((c) => <li key={c.name}><a href={`tel:${c.phone.replace(/\s/g, '')}`}>{c.name}</a></li>)}
              {site.socials.map((s) => <li key={s.label}><a href={s.href} target="_blank" rel="noreferrer">{s.label} ↗</a></li>)}
            </ul>
          </div>
        </div>
        <div className="footer__big" aria-hidden>
          {'IICM 9.0'.split('').map((c, i) => <span key={i}>{c}</span>)}
        </div>
        <div className="footer__bottom">
          <span>© 2026 IICM 9.0 Organising Committee, IIT Mandi</span>
          <span>Organised by the students of IIT Mandi</span>
        </div>
      </div>
    </footer>
  )
}
