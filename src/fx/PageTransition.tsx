import { Snowflake } from '../components/ui'

/** Snow sheets sweep up over the page, then lift away on the new route. */
export default function PageTransition({ phase }: { phase: 'idle' | 'cover' | 'reveal' }) {
  return (
    <div className={`transition ${phase !== 'idle' ? `is-${phase}` : ''}`} aria-hidden>
      <div className="transition__sheet transition__sheet--b" />
      <div className="transition__sheet" />
      <Snowflake className="transition__flake" />
    </div>
  )
}
