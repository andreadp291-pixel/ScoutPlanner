import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../state/authStore'
import { useMemberAuthStore } from '../state/memberAuthStore'

export function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const ownerEmail = useAuthStore((s) => s.email)
  const ownerLogout = useAuthStore((s) => s.logout)
  const memberName = useMemberAuthStore((s) => s.displayName)
  const memberLogout = useMemberAuthStore((s) => s.logout)

  function handleLogout() {
    ownerLogout()
    memberLogout()
    navigate('/', { replace: true })
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="brand">
          🏕️ ScoutPlanner
        </Link>
        {ownerEmail && (
          <nav>
            <Link to="/projects">I miei progetti</Link>
            <span className="muted">{ownerEmail}</span>
            <button type="button" className="link-button" onClick={handleLogout}>
              Esci
            </button>
          </nav>
        )}
        {!ownerEmail && memberName && (
          <nav>
            <Link to="/me/projects">I miei progetti</Link>
            <Link to="/member/change-password">Cambia password</Link>
            <span className="muted">{memberName}</span>
            <button type="button" className="link-button" onClick={handleLogout}>
              Esci
            </button>
          </nav>
        )}
      </header>
      <main className="page">{children}</main>
    </div>
  )
}
