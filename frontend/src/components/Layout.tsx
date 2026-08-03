import { Link } from 'react-router-dom'
import { useAuthStore } from '../state/authStore'

export function Layout({ children }: { children: React.ReactNode }) {
  const email = useAuthStore((s) => s.email)
  const logout = useAuthStore((s) => s.logout)

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="brand">
          🏕️ ScoutPlanner
        </Link>
        {email && (
          <nav>
            <Link to="/projects">I miei progetti</Link>
            <span className="muted">{email}</span>
            <button type="button" className="link-button" onClick={logout}>
              Esci
            </button>
          </nav>
        )}
      </header>
      <main className="page">{children}</main>
    </div>
  )
}
