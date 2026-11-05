import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { googleLogin } from '../api/auth'
import { useAuthStore } from '../state/authStore'
import { useMemberAuthStore } from '../state/memberAuthStore'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
const GIS_SRC = 'https://accounts.google.com/gsi/client'

interface TokenClient {
  requestAccessToken: () => void
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string
            scope: string
            callback: (r: { access_token?: string; error?: string }) => void
            error_callback?: (e: { type: string }) => void
          }) => TokenClient
        }
      }
    }
  }
}

let scriptPromise: Promise<void> | null = null
function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
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

const GoogleLogo = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.400 2.600 13.200l7.900 6.200C12.400 13.600 17.700 9.500 24 9.500Z" />
    <path fill="#4285F4" d="M46.500 24.500c0-1.600-.1-3.100-.4-4.500H24v9h12.700c-.6 3-2.300 5.500-4.800 7.200l7.500 5.800c4.400-4.100 7.100-10.100 7.100-17.500Z" />
    <path fill="#FBBC05" d="M10.500 28.600A14.500 14.500 0 0 1 9.500 24c0-1.600.3-3.200.8-4.600l-7.900-6.200A24 24 0 0 0 0 24c0 3.900.9 7.500 2.600 10.800l7.900-6.200Z" />
    <path fill="#34A853" d="M24 48c6.500 0 11.900-2.100 15.900-5.800l-7.500-5.800c-2.100 1.400-4.800 2.300-8.400 2.300-6.300 0-11.600-4.100-13.500-9.800l-7.900 6.200C6.500 42.600 14.600 48 24 48Z" />
  </svg>
)

// Pulsante "Continua con Google" nostro (stesso stile degli altri), che apre il popup di accesso di Google.
// Senza VITE_GOOGLE_CLIENT_ID non compare e gli altri accessi restano com'erano.
export function GoogleLoginButton() {
  const navigate = useNavigate()
  const setOwnerSession = useAuthStore((s) => s.setSession)
  const setMemberSession = useMemberAuthStore((s) => s.setSession)
  const clientRef = useRef<TokenClient | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!CLIENT_ID) return
    let cancelled = false
    loadGis()
      .then(() => {
        if (cancelled || !window.google) return
        clientRef.current = window.google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: 'openid email profile',
          callback: async ({ access_token }) => {
            if (!access_token) {
              setBusy(false)
              setError('Accesso con Google annullato')
              return
            }
            try {
              const res = await googleLogin(access_token)
              setOwnerSession(res.owner.session_token, res.owner.email)
              if (res.member) {
                setMemberSession(res.member.session_token, res.member.display_name, false)
              }
              // Un collaboratore invitato che non ha progetti propri va diretto ai suoi progetti.
              navigate(res.member && res.owner_projects === 0 ? '/me/projects' : '/projects', { replace: true })
            } catch (err) {
              setBusy(false)
              setError(err instanceof Error ? err.message : 'Errore imprevisto')
            }
          },
          // popup chiuso o bloccato dal browser
          error_callback: () => {
            setBusy(false)
            setError('Accesso con Google annullato o finestra bloccata dal browser')
          },
        })
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Errore imprevisto'))
    return () => {
      cancelled = true
    }
  }, [navigate, setOwnerSession, setMemberSession])

  if (!CLIENT_ID) return null

  function handleClick() {
    setError(null)
    if (!clientRef.current) {
      setError('Google si sta ancora caricando, riprova tra un attimo')
      return
    }
    setBusy(true)
    clientRef.current.requestAccessToken()
  }

  return (
    <div className="google-login">
      <div className="or">
        <span>oppure</span>
      </div>
      <button type="button" className="google-btn" onClick={handleClick} disabled={busy}>
        <GoogleLogo />
        <span>{busy ? 'Attendo Google...' : 'Continua con Google'}</span>
      </button>
      {error && (
        <p role="alert" style={{ color: 'var(--danger)', marginTop: 10 }}>
          {error}
        </p>
      )}
    </div>
  )
}
