import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { requestAccess } from '../api/collab'
import { useAuthStore } from '../state/authStore'
import { useMemberAuthStore } from '../state/memberAuthStore'

// Mostrata quando il progetto non si apre: chi ha un account può chiedere l'accesso al proprietario.
export function NoAccess({ projectId, what = 'Progetto' }: { projectId: number; what?: string }) {
  const signedIn = useAuthStore((s) => s.sessionToken) !== null || useMemberAuthStore((s) => s.sessionToken) !== null
  const [message, setMessage] = useState('')
  const mutation = useMutation({ mutationFn: () => requestAccess(projectId, { message }) })

  return (
    <div className="card" role="alert">
      <h2>{what} non disponibile</h2>
      <p className="muted">Non esiste, oppure non hai ancora accesso.</p>
      {!signedIn ? (
        <Link to="/login" className="btn primary">
          Accedi per chiedere l'accesso
        </Link>
      ) : mutation.isSuccess ? (
        <p className="share-link-box">Richiesta inviata: il proprietario del progetto potrà approvarla.</p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            mutation.mutate()
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 420 }}
        >
          <label>
            Messaggio per il proprietario (facoltativo)
            <input value={message} onChange={(e) => setMessage(e.target.value)} maxLength={500} placeholder="Sono del reparto..." />
          </label>
          <button type="submit" className="primary" disabled={mutation.isPending}>
            {mutation.isPending ? 'Invio...' : 'Chiedi accesso'}
          </button>
          {mutation.error && <p style={{ color: 'var(--danger)' }}>{mutation.error.message}</p>}
        </form>
      )}
    </div>
  )
}
