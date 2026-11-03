import { Arrow, Magnetic, PageHero } from '../components/ui'

export default function NotFound() {
  return (
    <div className="page">
      <PageHero kicker="404" title="Not found" lead="This page doesn't exist." />
      <div className="container"><Magnetic to="/">Back to home <Arrow /></Magnetic></div>
    </div>
  )
}
