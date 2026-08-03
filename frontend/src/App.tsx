import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAuthStore } from './state/authStore'
import { useMemberAuthStore } from './state/memberAuthStore'
import { Layout } from './components/Layout'
import { AuthCallback } from './routes/AuthCallback'
import { Home } from './routes/Home'
import { MemberChangePassword } from './routes/MemberChangePassword'
import { MemberLogin } from './routes/MemberLogin'
import { MemberProjectList } from './routes/MemberProjectList'
import { ProjectCalendar } from './routes/ProjectCalendar'
import { ProjectCreate } from './routes/ProjectCreate'
import { ProjectList } from './routes/ProjectList'
import { ProjectTokens } from './routes/ProjectTokens'

const queryClient = new QueryClient()

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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/login" element={<MemberLogin />} />
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
              path="/projects/:projectId/tokens"
              element={
                <RequireOwnerSession>
                  <ProjectTokens />
                </RequireOwnerSession>
              }
            />
          </Routes>
        </Layout>
      </HashRouter>
    </QueryClientProvider>
  )
}

export default App
