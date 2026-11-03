import { committees } from '../data/team'
import { PageHero, Reveal } from '../components/ui'

const initials = (name: string) =>
  name === 'Name TBA' ? '' : name.split(' ').map((w) => w[0]).slice(0, 2).join('')

export default function Team() {
  return (
    <div className="page">
      <PageHero kicker="Organising committee" title="Team" lead="The students and faculty organising IICM 9.0 at IIT Mandi. Names and photos will be added soon." />
      <div className="container">
        {committees.map((c) => (
          <section className="committee" key={c.slug} id={c.slug}>
            <div>
              <h2>{c.name}</h2>
              <p className="committee__count">{c.members.length} members</p>
            </div>
            <div className="members">
              {c.members.map((m, i) => (
                <Reveal key={i} delay={i * 60} className={`member frost frost--hover ${m.name === 'Name TBA' ? 'is-placeholder' : ''}`}>
                  <div className="member__photo">
                    {m.photo ? <img src={m.photo} alt={m.name} loading="lazy" /> : <span className="member__initials">{initials(m.name)}</span>}
                  </div>
                  <h3>{m.name}</h3>
                  <p>{m.role}</p>
                  {m.phone && <p><a href={`tel:${m.phone.replace(/\s/g, '')}`}>{m.phone}</a></p>}
                </Reveal>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
