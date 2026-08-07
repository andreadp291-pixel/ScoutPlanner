import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { memberLogin } from '../api/auth'
import { useMemberAuthStore } from '../state/memberAuthStore'

export function MemberLogin() {
  const navigate = useNavigate()
  const setSession = useMemberAuthStore((s) => s.setSession)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await memberLogin(email, password)
      setSession(res.session_token, res.display_name, res.must_change_password)
      navigate(res.must_change_password ? '/member/change-password' : '/me/projects', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore imprevisto')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h1>Accedi</h1>
      <p className="muted" style={{ marginBottom: 24 }}>
        Se sei stato invitato a un progetto via email, usa qui le tue credenziali.
      </p>
      <form className="card" onSubmit={handleSubmit} style={{ maxWidth: 380 }}>
        <label>
          Email
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Password
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
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
      <p className="muted" style={{ marginTop: 16 }}>
        Sei un capo squadriglia? <Link to="/">Accedi con il magic link</Link>
      </p>
    </div>
  )
}
