import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { verifyLink } from '../api/auth'
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
      <div>
        <h1>Accesso non riuscito</h1>
        <p>{error}</p>
      </div>
    )
  }

  return <p>Verifica in corso...</p>
}
