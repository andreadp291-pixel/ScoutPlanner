import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ownerLogin } from '../api/auth'
import { AuthLayout } from '../components/AuthLayout'
import { GoogleLoginButton } from '../components/GoogleLoginButton'
import { useAuthStore } from '../state/authStore'

export function OwnerLogin() {
  const navigate = useNavigate()
  const setSession = useAuthStore((s) => s.setSession)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await ownerLogin(email, password)
      setSession(res.session_token, res.email)
      navigate('/projects', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore imprevisto')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Accesso con password"
      sub="Se hai già impostato una password dal menu account, accedi qui direttamente."
      footer={<Link to="/">Preferisco il link via email</Link>}
    >
      <form onSubmit={handleSubmit}>
        <label>
          Email
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Password
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <button type="submit" className="primary" disabled={loading}>
          {loading ? 'Accesso...' : 'Accedi'}
        </button>
        {error && (
          <p role="alert" style={{ color: 'var(--danger)', marginTop: 10 }}>
            {error}
          </p>
        )}
      </form>
      <GoogleLoginButton />
    </AuthLayout>
  )
}
