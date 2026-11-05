import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { memberChangePassword } from '../api/auth'
import { AuthLayout } from '../components/AuthLayout'
import { useMemberAuthStore } from '../state/memberAuthStore'

export function MemberChangePassword() {
  const navigate = useNavigate()
  const displayName = useMemberAuthStore((s) => s.displayName)
  const setSession = useMemberAuthStore((s) => s.setSession)
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (newPassword !== confirm) {
      setError('Le due password non coincidono')
      return
    }
    try {
      const res = await memberChangePassword(newPassword)
      setSession(res.session_token, res.display_name, res.must_change_password)
      navigate('/me/projects', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore imprevisto')
    }
  }

  return (
    <AuthLayout
      title="Scegli la tua password"
      sub={`Ciao ${displayName ?? ''}, scegli una nuova password personale (minimo 10 caratteri).`}
      footer={<Link to="/me/projects">Torna ai progetti</Link>}
    >
      <form onSubmit={handleSubmit}>
        <label>
          Nuova password
          <input
            type="password"
            required
            minLength={10}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </label>
        <label>
          Conferma password
          <input
            type="password"
            required
            minLength={10}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </label>
        <button type="submit" className="primary">
          Salva password
        </button>
        {error && (
          <p role="alert" style={{ color: 'var(--danger)', marginTop: 10 }}>
            {error}
          </p>
        )}
      </form>
    </AuthLayout>
  )
}
