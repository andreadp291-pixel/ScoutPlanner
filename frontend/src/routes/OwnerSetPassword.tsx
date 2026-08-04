import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ownerSetPassword } from '../api/auth'
import { ArrowLeftIcon } from '../components/icons/ArrowLeftIcon'
import { useAuthStore } from '../state/authStore'

export function OwnerSetPassword() {
  const setSession = useAuthStore((s) => s.setSession)
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (newPassword !== confirm) {
      setError('Le due password non coincidono')
      return
    }
    try {
      const res = await ownerSetPassword(newPassword)
      setSession(res.session_token, res.email)
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore imprevisto')
    }
  }

  return (
    <div>
      <h1>Imposta o aggiorna la password</h1>
      <p className="muted" style={{ marginBottom: 24 }}>
        Con una password non dovrai più aspettare l'email ogni volta: potrai accedere direttamente da{' '}
        <Link to="/login/owner">questa pagina</Link>. Il magic link resta comunque sempre disponibile.
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
        {success && <p style={{ color: 'var(--accent)', marginTop: 10 }}>Password salvata.</p>}
        {error && (
          <p role="alert" style={{ color: 'var(--danger)', marginTop: 10 }}>
            {error}
          </p>
        )}
      </form>
      <p style={{ marginTop: 16 }}>
        <Link to="/projects" className="btn">
          <ArrowLeftIcon />
          Torna ai progetti
        </Link>
      </p>
    </div>
  )
}
