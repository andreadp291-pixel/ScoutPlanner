import { useQuery } from '@tanstack/react-query'
import { Link, useLocation, useMatch } from 'react-router-dom'
import { getProject } from '../api/projects'
import { useAuthStore } from '../state/authStore'
import { useMemberAuthStore } from '../state/memberAuthStore'
import { AccountMenu } from './AccountMenu'
import { BrandIcon } from './icons/BrandIcon'
import { CalendarIcon } from './icons/CalendarIcon'
import { FolderIcon } from './icons/FolderIcon'
import { HomeIcon } from './icons/HomeIcon'
import { InfoIcon } from './icons/InfoIcon'
import { ListIcon } from './icons/ListIcon'
import { ThemeToggle } from './ThemeToggle'
import { UsersIcon } from './icons/UsersIcon'
import { ViewModeToggle } from './ViewModeToggle'

// Pagine di accesso: hanno un loro layout a tutta pagina (vedi AuthLayout), senza barra di navigazione.
const AUTH_PATHS = ['/', '/login', '/login/owner', '/auth/callback', '/member/change-password']

export function Layout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  const ownerEmail = useAuthStore((s) => s.email)
  const ownerLogout = useAuthStore((s) => s.logout)
  const memberName = useMemberAuthStore((s) => s.displayName)
  const memberLogout = useMemberAuthStore((s) => s.logout)

  const match = useMatch('/projects/:projectId/*')
  const projectId = match && /^\d+$/.test(match.params.projectId ?? '') ? Number(match.params.projectId) : null
  const projectQuery = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId!),
    enabled: projectId !== null,
  })

  if (AUTH_PATHS.includes(pathname)) return <>{children}</>

  const projectsHome = ownerEmail ? '/projects' : '/me/projects'
  const base = `/projects/${projectId}`
  const sections =
    projectId === null
      ? []
      : [
          { to: base, label: 'Panoramica', icon: <HomeIcon size={20} />, active: pathname === base || pathname.startsWith(`${base}/activities`) },
          { to: `${base}/calendar`, label: 'Calendario', icon: <CalendarIcon size={20} />, active: pathname.startsWith(`${base}/calendar`) },
          { to: `${base}/materials`, label: 'Materiali', icon: <ListIcon size={20} />, active: pathname.startsWith(`${base}/materials`) },
          { to: `${base}/info`, label: 'Info', icon: <InfoIcon size={20} />, active: pathname.startsWith(`${base}/info`) || pathname.startsWith(`${base}/pages`) },
          ...(ownerEmail ? [{ to: `${base}/tokens`, label: 'Persone', icon: <UsersIcon size={20} />, active: pathname.startsWith(`${base}/tokens`) }] : []),
        ]

  const accountItems = ownerEmail
    ? [
        { to: '/projects', label: 'I miei progetti' },
        { to: '/account/email', label: 'Notifiche email' },
        { to: '/owner/set-password', label: 'Imposta password' },
      ]
    : [
        { to: '/me/projects', label: 'I miei progetti' },
        { to: '/account/email', label: 'Notifiche email' },
        { to: '/member/change-password', label: 'Cambia password' },
      ]
  const accountLabel = ownerEmail ?? memberName
  function logout() {
    ownerLogout()
    memberLogout()
  }

  return (
    <div className={`app-shell${sections.length ? ' has-tabbar' : ''}`}>
      <header className="app-header">
        <Link to="/" className="brand" aria-label="ScoutPlanner">
          <BrandIcon />
          <span className="brand-text">ScoutPlanner</span>
        </Link>
        <nav className="app-nav" aria-label="Navigazione">
          <Link to={projectsHome} className={`nav-link${projectId === null ? ' active' : ''}`}>
            <FolderIcon size={18} />
            Progetti
          </Link>
          {sections.length > 0 && (
            <>
              <span className="nav-proj">{projectQuery.data?.name ?? ''}</span>
              {sections.map((s) => (
                <Link key={s.to} to={s.to} className={`nav-link${s.active ? ' active' : ''}`} aria-current={s.active ? 'page' : undefined}>
                  {s.icon}
                  {s.label}
                </Link>
              ))}
            </>
          )}
        </nav>
        <div className="app-header-actions">
          <ViewModeToggle />
          <ThemeToggle />
          {accountLabel && (
            <AccountMenu label={accountLabel} initial={accountLabel.charAt(0).toUpperCase()} items={accountItems} onLogout={logout} />
          )}
        </div>
      </header>
      <main className="page">{children}</main>
      {sections.length > 0 && (
        <nav className="tabbar" aria-label="Sezioni del progetto">
          {sections.map((s) => (
            <Link key={s.to} to={s.to} className={`tab${s.active ? ' active' : ''}`} aria-current={s.active ? 'page' : undefined}>
              {s.icon}
              <span>{s.label}</span>
            </Link>
          ))}
        </nav>
      )}
    </div>
  )
}
