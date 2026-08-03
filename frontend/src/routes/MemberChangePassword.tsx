import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { memberChangePassword } from '../api/auth'
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
      setSession(res.session_token, res.display_name)
      navigate('/me/projects', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore imprevisto')
    }
  }

  return (
    <div>
      <h1>Imposta una password personale</h1>
      <p className="muted" style={{ marginBottom: 24 }}>
        Ciao {displayName}, per continuare imposta una password personale (minimo 10 caratteri).
      </p>
      <form className="card" onSubmit={handleSubmit} style={{ maxWidth: 380 }}>
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
    </div>
  )
}
