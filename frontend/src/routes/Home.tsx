import { useState } from 'react'
import { Link } from 'react-router-dom'
import { requestLink } from '../api/auth'
import { AuthLayout } from '../components/AuthLayout'
import { GoogleLoginButton } from '../components/GoogleLoginButton'

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
      <AuthLayout
        title="Controlla la tua email"
        sub={<>Ti abbiamo inviato un link di accesso a <strong>{email}</strong>. Il link scade tra 15 minuti.</>}
        footer={<button type="button" className="link-button" onClick={() => setSent(false)}>Usa un'altra email</button>}
      >
        <p className="muted">Non lo vedi? Controlla anche la cartella dello spam.</p>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Accedi a ScoutPlanner"
      sub="Scrivi la tua email e ti mandiamo un link di accesso. Niente password da ricordare."
      footer={
        <>
          <Link to="/login/owner">Ho già una password</Link>
          <Link to="/login">Sono stato invitato a un progetto</Link>
        </>
      }
    >
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
        <button type="submit" className="primary">
          Ricevi il link di accesso
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
