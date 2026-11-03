import { useEffect, useRef, useState, type ReactNode, type CSSProperties, type ElementType } from 'react'
import { Link } from 'react-router-dom'
import { isTouch, prefersReducedMotion } from '../lib/motion'

/** Six-armed snowflake used for loader, page hero, placeholders. */
export function Snowflake({ className, style }: { className?: string; style?: CSSProperties }) {
  const arms = [0, 60, 120, 180, 240, 300]
  return (
    <svg viewBox="-32 -32 64 64" className={className} style={style} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
      {arms.map((a) => (
        <g key={a} transform={`rotate(${a})`}>
          <path d="M0 0 V-28" pathLength={60} />
          <path d="M0 -10 L-6 -16 M0 -10 L6 -16 M0 -19 L-5 -24 M0 -19 L5 -24" pathLength={60} />
        </g>
      ))}
      <circle r="3.5" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** Lumpy snow drift that sits on a card's top edge and "accumulates" on hover (parent must be :hover target). */
export function SnowCap({ seed = 1 }: { seed?: number }) {
  const ref = useRef<SVGPathElement>(null)
  const make = (amp: number) => {
    let d = 'M0 18 L0 10 '
    const n = 9
    for (let i = 1; i <= n; i++) {
      const x = (i / n) * 100
      const y = 10 - amp * (0.5 + 0.5 * Math.sin(i * 1.7 + seed * 2.3))
      d += `Q ${x - 100 / n / 2} ${y - amp * 0.6} ${x} ${y} `
    }
    return d + 'L100 18 Z'
  }
  useEffect(() => {
    const path = ref.current
    const host = path?.closest('.frost')
    if (!path || !host) return
    const on = () => path.setAttribute('d', make(7))
    const off = () => path.setAttribute('d', make(3.5))
    host.addEventListener('mouseenter', on)
    host.addEventListener('mouseleave', off)
    return () => {
      host.removeEventListener('mouseenter', on)
      host.removeEventListener('mouseleave', off)
    }
  })
  return (
    <svg className="snowcap" viewBox="0 0 100 18" preserveAspectRatio="none" aria-hidden>
      <path ref={ref} d={make(3.5)} />
    </svg>
  )
}

/** Reveal on scroll into view. */
export function useInView<T extends Element>(opts: IntersectionObserverInit = { threshold: 0.2 }) {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        setInView(true)
        io.disconnect()
      }
    }, opts)
    io.observe(el)
    return () => io.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return [ref, inView] as const
}

export function Reveal({ children, delay = 0, as: Tag = 'div', className = '', style }: { children: ReactNode; delay?: number; as?: ElementType; className?: string; style?: CSSProperties }) {
  const [ref, inView] = useInView<HTMLDivElement>()
  const T = Tag as 'div'
  return (
    <T ref={ref} className={`reveal ${inView ? 'is-in' : ''} ${className}`} style={{ ...style, '--d': `${delay}ms` } as CSSProperties}>
      {children}
    </T>
  )
}

/** Splits text into letters that rise in with a stagger. */
export function SplitText({ text, className = '', as: Tag = 'span', play }: { text: string; className?: string; as?: ElementType; play?: boolean }) {
  const [ref, inView] = useInView<HTMLElement>({ threshold: 0.1 })
  const on = play ?? inView
  let i = 0
  const T = Tag as 'span'
  return (
    <T ref={ref as React.Ref<HTMLSpanElement>} className={`split ${on ? 'is-in' : ''} ${className}`} aria-label={text}>
      {text.split(' ').map((word, w) => (
        <span key={w} aria-hidden style={{ whiteSpace: 'nowrap', display: 'inline-block' }}>
          {w > 0 && <span className="sp"> </span>}
          {[...word].map((ch) => (
            <span key={i} className="ch" style={{ '--i': i++ } as CSSProperties}>
              {ch}
            </span>
          ))}
        </span>
      ))}
    </T>
  )
}

/** Button/link that leans toward the cursor and tracks a glow under it. */
export function Magnetic({ to, href, onClick, children, variant = '', className = '', ...rest }: {
  to?: string; href?: string; onClick?: () => void; children: ReactNode; variant?: '' | 'ghost' | 'ember' | 'sm' | 'ghost sm'; className?: string; target?: string; rel?: string; 'aria-label'?: string
}) {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || isTouch() || prefersReducedMotion()) return
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      const x = e.clientX - r.left
      const y = e.clientY - r.top
      el.style.setProperty('--mx', `${x}px`)
      el.style.setProperty('--my', `${y}px`)
      el.style.transform = `translate(${(x - r.width / 2) * 0.22}px, ${(y - r.height / 2) * 0.3}px)`
    }
    const leave = () => {
      el.style.transform = ''
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerleave', leave)
    return () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerleave', leave)
    }
  }, [])
  const cls = `btn ${variant.split(' ').filter(Boolean).map((v) => `btn--${v}`).join(' ')} ${className}`
  if (to) return <Link ref={ref as React.Ref<HTMLAnchorElement>} to={to} className={cls} {...rest}>{children}</Link>
  if (href) return <a ref={ref as React.Ref<HTMLAnchorElement>} href={href} className={cls} {...rest}>{children}</a>
  return <button ref={ref as React.Ref<HTMLButtonElement>} type="button" onClick={onClick} className={cls} {...rest}>{children}</button>
}

export const Arrow = () => <span className="arrow" aria-hidden>→</span>

export function PageHero({ kicker, title, lead }: { kicker: string; title: string; lead?: ReactNode }) {
  return (
    <header className="page-hero container">
      <p className="eyebrow">{kicker}</p>
      <SplitText as="h1" className="display display--wide" text={title} />
      {lead && <Reveal delay={200}><p className="lead">{lead}</p></Reveal>}
    </header>
  )
}

let toastTimer = 0
export function toast(msg: string) {
  let el = document.querySelector<HTMLDivElement>('.toast')
  if (!el) {
    el = document.createElement('div')
    el.className = 'toast'
    el.setAttribute('role', 'status')
    document.body.appendChild(el)
  }
  el.textContent = msg
  requestAnimationFrame(() => el!.classList.add('is-on'))
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => el!.classList.remove('is-on'), 2600)
}
