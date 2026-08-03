import { useState } from 'react'
import { Link } from 'react-router-dom'
import { requestLink } from '../api/auth'

export function Home() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await requestLink(email)
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore imprevisto')
    }
  }

  if (sent) {
    return (
      <div className="card" style={{ maxWidth: 420 }}>
        <h1>Controlla la tua email</h1>
        <p>Ti abbiamo inviato un link di accesso a {email}. Il link scade tra 15 minuti.</p>
      </div>
    )
  }

  return (
    <div>
      <h1>ScoutPlanner</h1>
      <p className="muted" style={{ marginBottom: 24 }}>
        Crea vademecum per campi e uscite, in coworking con la tua squadriglia.
      </p>
      <form className="card" onSubmit={handleSubmit} style={{ maxWidth: 420 }}>
        <label>
          La tua email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="capo@example.com"
          />
        </label>
        <button type="submit" className="primary">
          Ricevi link di accesso
        </button>
        {error && (
          <p role="alert" style={{ color: 'var(--danger)', marginTop: 10 }}>
            {error}
          </p>
        )}
      </form>
      <p className="muted" style={{ marginTop: 16 }}>
        Hai già impostato una password? <Link to="/login/owner">Accedi con email e password</Link>
      </p>
      <p className="muted" style={{ marginTop: 4 }}>
        Sei stato invitato a un progetto via email? <Link to="/login">Accedi come collaboratore</Link>
      </p>
    </div>
  )
}
