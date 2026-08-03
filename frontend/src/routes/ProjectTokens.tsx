import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import {
  createToken,
  listTokens,
  regenerateToken,
  revokeToken,
  type ProjectTokenCreated,
} from '../api/tokens'

function shareUrlFor(projectId: number, rawToken: string): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}#/projects/${projectId}?t=${rawToken}`
}

export function ProjectTokens() {
  const { projectId } = useParams()
  const id = Number(projectId)
  const queryClient = useQueryClient()

  const tokensQuery = useQuery({ queryKey: ['tokens', id], queryFn: () => listTokens(id) })
  const [personName, setPersonName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'editor' | 'viewer'>('editor')
  const [revealed, setRevealed] = useState<Record<number, ProjectTokenCreated>>({})

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['tokens', id] })

  const createMutation = useMutation({
    mutationFn: () => createToken(id, { person_name: personName, email: email || undefined, role }),
    onSuccess: (token) => {
      setRevealed((prev) => ({ ...prev, [token.id]: token }))
      setPersonName('')
      setEmail('')
      invalidate()
    },
  })

  const regenerateMutation = useMutation({
    mutationFn: (tokenId: number) => regenerateToken(id, tokenId),
    onSuccess: (token) => {
      setRevealed((prev) => ({ ...prev, [token.id]: token }))
      invalidate()
    },
  })

  const revokeMutation = useMutation({
    mutationFn: (tokenId: number) => revokeToken(id, tokenId),
    onSuccess: () => invalidate(),
  })

  return (
    <div>
      <p>
        <Link to={`/projects/${id}`}>← Torna al calendario</Link>
      </p>
      <h1>Gestisci persone</h1>
      <p className="muted">
        Ogni persona riceve un link personale per accedere al progetto, senza bisogno di crearsi un account.
      </p>

      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault()
          createMutation.mutate()
        }}
      >
        <h2>Invita una persona</h2>
        <div className="form-row">
          <label>
            Nome
            <input required value={personName} onChange={(e) => setPersonName(e.target.value)} placeholder="Marco" />
          </label>
          <label>
            Email (opzionale, invia il link automaticamente)
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="marco@example.com"
            />
          </label>
          <label>
            Ruolo
            <select value={role} onChange={(e) => setRole(e.target.value as 'editor' | 'viewer')}>
              <option value="editor">Editor — può modificare</option>
              <option value="viewer">Sola lettura</option>
            </select>
          </label>
        </div>
        <button type="submit" className="primary" disabled={createMutation.isPending}>
          {createMutation.isPending ? 'Creazione...' : 'Genera invito'}
        </button>
      </form>

      <h2>Persone con accesso</h2>
      <table className="tokens-table">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Email</th>
            <th>Ruolo</th>
            <th>Stato</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {tokensQuery.data?.map((t) => {
            const reveal = revealed[t.id]
            return (
              <tr key={t.id} className={t.revoked_at ? 'revoked' : ''}>
                <td>{t.person_name}</td>
                <td>{t.email ?? <span className="muted">—</span>}</td>
                <td>{t.role === 'editor' ? 'Editor' : 'Sola lettura'}</td>
                <td>{t.revoked_at ? 'Revocato' : 'Attivo'}</td>
                <td className="actions">
                  <button
                    type="button"
                    onClick={() => regenerateMutation.mutate(t.id)}
                    disabled={regenerateMutation.isPending}
                  >
                    Rigenera link
                  </button>
                  {!t.revoked_at && (
                    <button
                      type="button"
                      className="danger"
                      onClick={() => revokeMutation.mutate(t.id)}
                      disabled={revokeMutation.isPending}
                    >
                      Revoca
                    </button>
                  )}
                  {reveal && (
                    <div className="share-link-box">
                      {reveal.email_sent ? (
                        <p>Link inviato via email a {reveal.email}.</p>
                      ) : (
                        <p>Copia e invia questo link (mostrato una sola volta):</p>
                      )}
                      <code>{shareUrlFor(id, reveal.raw_token)}</code>
                    </div>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {tokensQuery.data?.length === 0 && <p className="muted">Nessuna persona invitata ancora.</p>}
    </div>
  )
}
