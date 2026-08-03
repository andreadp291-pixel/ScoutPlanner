import { useState } from 'react'
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
      <div>
        <h1>Controlla la tua email</h1>
        <p>Ti abbiamo inviato un link di accesso a {email}. Il link scade tra 15 minuti.</p>
      </div>
    )
  }

  return (
    <div>
      <h1>ScoutPlanner</h1>
      <p>Crea vademecum per campi e uscite, in coworking con la tua squadriglia.</p>
      <form onSubmit={handleSubmit}>
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
        <button type="submit">Ricevi link di accesso</button>
      </form>
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
