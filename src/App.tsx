import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuthStore } from './state/authStore'
import { useMemberAuthStore } from './state/memberAuthStore'
import { Layout } from './components/Layout'
import { ActivityDescription } from './routes/ActivityDescription'
import { AuthCallback } from './routes/AuthCallback'
import { Home } from './routes/Home'
import { MemberChangePassword } from './routes/MemberChangePassword'
import { MemberLogin } from './routes/MemberLogin'
import { MemberProjectList } from './routes/MemberProjectList'
import { OwnerLogin } from './routes/OwnerLogin'
import { OwnerSetPassword } from './routes/OwnerSetPassword'
import { ProjectCalendar } from './routes/ProjectCalendar'
import { ProjectCreate } from './routes/ProjectCreate'
import { ProjectInfo } from './routes/ProjectInfo'
import { ProjectList } from './routes/ProjectList'
import { ProjectPageEditor } from './routes/ProjectPageEditor'
import { ProjectTokens } from './routes/ProjectTokens'

const queryClient = new QueryClient()

const PASSWORD_CHANGE_EXEMPT_PATHS = ['/member/change-password', '/login', '/', '/auth/callback']

function RequireOwnerSession({ children }: { children: React.ReactNode }) {
  const sessionToken = useAuthStore((s) => s.sessionToken)
  if (!sessionToken) return <Navigate to="/" replace />
  return <>{children}</>
}

function RequireMemberSession({ children }: { children: React.ReactNode }) {
  const sessionToken = useMemberAuthStore((s) => s.sessionToken)
  if (!sessionToken) return <Navigate to="/login" replace />
  return <>{children}</>
}

// Se un membro ha una password provvisoria non ancora cambiata, forza sempre il
// passaggio da /member/change-password prima di poter usare qualsiasi altra pagina,
// anche riaprendo il browser con la sessione già salvata (non solo al login).
function EnforceMemberPasswordChange({ children }: { children: React.ReactNode }) {
  const ownerEmail = useAuthStore((s) => s.email)
  const memberSessionToken = useMemberAuthStore((s) => s.sessionToken)
  const mustChangePassword = useMemberAuthStore((s) => s.mustChangePassword)
  const location = useLocation()

  if (
    !ownerEmail &&
    memberSessionToken &&
    mustChangePassword &&
    !PASSWORD_CHANGE_EXEMPT_PATHS.includes(location.pathname)
  ) {
    return <Navigate to="/member/change-password" replace />
  }
  return <>{children}</>
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <Layout>
          <EnforceMemberPasswordChange>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/login" element={<MemberLogin />} />
              <Route path="/login/owner" element={<OwnerLogin />} />
              <Route
                path="/member/change-password"
                element={
                  <RequireMemberSession>
                    <MemberChangePassword />
                  </RequireMemberSession>
                }
              />
              <Route
                path="/me/projects"
                element={
                  <RequireMemberSession>
                    <MemberProjectList />
                  </RequireMemberSession>
                }
              />
              <Route
                path="/owner/set-password"
                element={
                  <RequireOwnerSession>
                    <OwnerSetPassword />
                  </RequireOwnerSession>
                }
              />
              <Route
                path="/projects"
                element={
                  <RequireOwnerSession>
                    <ProjectList />
                  </RequireOwnerSession>
                }
              />
              <Route
                path="/projects/new"
                element={
                  <RequireOwnerSession>
                    <ProjectCreate />
                  </RequireOwnerSession>
                }
              />
              {/* Raggiungibile da owner, membri con account, o chi ha un token di condivisione (?t=...) */}
              <Route path="/projects/:projectId" element={<ProjectCalendar />} />
              <Route
                path="/projects/:projectId/activities/:activityId/description"
                element={<ActivityDescription />}
              />
              <Route path="/projects/:projectId/info" element={<ProjectInfo />} />
              <Route path="/projects/:projectId/pages/:pageId" element={<ProjectPageEditor />} />
              <Route
                path="/projects/:projectId/tokens"
                element={
                  <RequireOwnerSession>
                    <ProjectTokens />
                  </RequireOwnerSession>
                }
              />
            </Routes>
          </EnforceMemberPasswordChange>
        </Layout>
      </HashRouter>
    </QueryClientProvider>
  )
}

export default App
