import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { googleLogin } from '../api/auth'
import { useAuthStore } from '../state/authStore'
import { useMemberAuthStore } from '../state/memberAuthStore'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
const GIS_SRC = 'https://accounts.google.com/gsi/client'

interface GoogleId {
  initialize: (config: { client_id: string; callback: (r: { credential: string }) => void }) => void
  renderButton: (el: HTMLElement, options: Record<string, unknown>) => void
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } }
  }
}

let scriptPromise: Promise<void> | null = null
function loadGis(): Promise<void> {
  if (window.google) return Promise.resolve()
  scriptPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = GIS_SRC
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => {
      scriptPromise = null
      reject(new Error('Impossibile caricare Google'))
    }
    document.head.appendChild(s)
  })
  return scriptPromise
}

// Senza VITE_GOOGLE_CLIENT_ID il pulsante non compare e gli altri accessi restano com'erano.
export function GoogleLoginButton() {
  const navigate = useNavigate()
  const setOwnerSession = useAuthStore((s) => s.setSession)
  const setMemberSession = useMemberAuthStore((s) => s.setSession)
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!CLIENT_ID) return
    let cancelled = false
    loadGis()
      .then(() => {
        if (cancelled || !containerRef.current || !window.google) return
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: async ({ credential }) => {
            setError(null)
            try {
              const res = await googleLogin(credential)
              setOwnerSession(res.owner.session_token, res.owner.email)
              if (res.member) {
                setMemberSession(res.member.session_token, res.member.display_name, false)
              }
              // Un collaboratore invitato che non ha progetti propri va diretto ai suoi progetti.
              navigate(res.member && res.owner_projects === 0 ? '/me/projects' : '/projects', { replace: true })
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Errore imprevisto')
            }
          },
        })
        window.google.accounts.id.renderButton(containerRef.current, {
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          locale: 'it',
        })
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Errore imprevisto'))
    return () => {
      cancelled = true
    }
  }, [navigate, setOwnerSession, setMemberSession])

  if (!CLIENT_ID) return null

  return (
    <div style={{ marginTop: 16 }}>
      <div ref={containerRef} />
      {error && (
        <p role="alert" style={{ color: 'var(--danger)', marginTop: 10 }}>
          {error}
        </p>
      )}
    </div>
  )
}
