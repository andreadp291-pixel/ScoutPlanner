import { Link } from 'react-router-dom'
import { useAuthStore } from '../state/authStore'
import { useMemberAuthStore } from '../state/memberAuthStore'
import { BrandIcon } from './icons/BrandIcon'
import { ThemeToggle } from './ThemeToggle'

function HeroArt() {
  return (
    <svg className="hero-art" viewBox="0 0 520 360" role="img" aria-label="Tenda e falò sotto le montagne">
      <circle cx="410" cy="78" r="30" fill="var(--art2)" />
      <path d="M0 250 130 130l70 80 70-110 120 150 130-90v250H0Z" fill="var(--art3)" />
      <path d="M0 290 90 215l80 60 90-80 110 110 150-70v125H0Z" fill="var(--art4)" />
      <path d="M70 330 170 190l100 140Z" fill="var(--art1)" />
      <path d="M170 190 150 330h40Z" fill="var(--art5)" />
      <path d="M360 330c-22 0-36-16-36-34 0-16 12-26 18-38 6 8 10 12 16 14 3-16 10-27 18-35 2 18 22 30 22 58 0 20-14 35-38 35Z" fill="var(--art2)" />
      <path d="M360 330c-10 0-17-8-17-17 0-8 6-13 9-19 3 4 5 6 8 7 1-8 5-13 9-17 1 9 10 15 10 29 0 10-8 17-19 17Z" fill="var(--art5)" />
      <g fill="var(--art5)" opacity=".8">
        <circle cx="60" cy="60" r="2" />
        <circle cx="130" cy="34" r="1.6" />
        <circle cx="250" cy="52" r="2" />
        <circle cx="300" cy="24" r="1.6" />
        <circle cx="470" cy="150" r="1.8" />
      </g>
    </svg>
  )
}

interface AuthLayoutProps {
  title: string
  sub?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
}

// Schermata di accesso: pannello verde con illustrazione a sinistra, scheda a destra.
export function AuthLayout({ title, sub, children, footer }: AuthLayoutProps) {
  const ownerEmail = useAuthStore((s) => s.email)
  const memberToken = useMemberAuthStore((s) => s.sessionToken)
  const alreadyIn = ownerEmail ? '/projects' : memberToken ? '/me/projects' : null

  return (
    <div className="auth">
      <aside className="auth-hero">
        <div className="hero-in">
          <div className="hero-brand">
            <BrandIcon size={28} />
            <span>ScoutPlanner</span>
          </div>
          <p className="hero-claim">Il vademecum del campo, scritto insieme.</p>
          <p className="hero-sub">
            Orari al minuto, materiali, mappe e contatti in un solo posto, per tutta la comunità capi.
          </p>
          <HeroArt />
        </div>
      </aside>
      <section className="auth-main">
        <div className="auth-top">
          <ThemeToggle />
        </div>
        <div className="auth-card">
          <h1>{title}</h1>
          {sub && <p className="sub">{sub}</p>}
          {children}
          {(footer || alreadyIn) && (
            <div className="auth-foot">
              {footer}
              {alreadyIn && <Link to={alreadyIn}>Vai ai tuoi progetti</Link>}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
