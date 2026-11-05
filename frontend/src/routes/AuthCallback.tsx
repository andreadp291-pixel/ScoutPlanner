import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { verifyLink } from '../api/auth'
import { AuthLayout } from '../components/AuthLayout'
import { useAuthStore } from '../state/authStore'

export function AuthCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const setSession = useAuthStore((s) => s.setSession)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const token = searchParams.get('token')
    if (!token) {
      setError('Link non valido: token mancante')
      return
    }
    verifyLink(token)
      .then((res) => {
        setSession(res.session_token, res.email)
        navigate('/projects', { replace: true })
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Link non valido o scaduto'))
  }, [searchParams, navigate, setSession])

  if (error) {
    return (
      <AuthLayout title="Accesso non riuscito" sub={error} footer={<Link to="/">Richiedi un nuovo link</Link>}>
        <p className="muted">I link di accesso valgono 15 minuti e si usano una volta sola.</p>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Verifica in corso..." sub="Un momento, ti stiamo facendo entrare.">
      <p className="muted">Se non succede nulla, torna indietro e richiedi un nuovo link.</p>
    </AuthLayout>
  )
}
