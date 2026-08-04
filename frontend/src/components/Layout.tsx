import { Link } from 'react-router-dom'
import { useAuthStore } from '../state/authStore'
import { useMemberAuthStore } from '../state/memberAuthStore'
import { AccountMenu } from './AccountMenu'
import { BrandIcon } from './icons/BrandIcon'
import { ThemeToggle } from './ThemeToggle'

export function Layout({ children }: { children: React.ReactNode }) {
  const ownerEmail = useAuthStore((s) => s.email)
  const ownerLogout = useAuthStore((s) => s.logout)
  const memberName = useMemberAuthStore((s) => s.displayName)
  const memberLogout = useMemberAuthStore((s) => s.logout)

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="brand">
          <BrandIcon />
          ScoutPlanner
        </Link>
        <div className="app-header-actions">
          <ThemeToggle />
          {ownerEmail && (
            <AccountMenu
              label={ownerEmail}
              initial={ownerEmail.charAt(0).toUpperCase()}
              items={[
                { to: '/projects', label: 'I miei progetti' },
                { to: '/owner/set-password', label: 'Imposta password' },
              ]}
              onLogout={() => {
                ownerLogout()
                memberLogout()
              }}
            />
          )}
          {!ownerEmail && memberName && (
            <AccountMenu
              label={memberName}
              initial={memberName.charAt(0).toUpperCase()}
              items={[
                { to: '/me/projects', label: 'I miei progetti' },
                { to: '/member/change-password', label: 'Cambia password' },
              ]}
              onLogout={() => {
                ownerLogout()
                memberLogout()
              }}
            />
          )}
        </div>
      </header>
      <main className="page">{children}</main>
    </div>
  )
}
