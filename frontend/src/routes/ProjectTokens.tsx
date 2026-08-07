import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import {
  inviteMember,
  listMembers,
  removeMember,
  resetMemberPassword,
} from '../api/members'
import {
  createToken,
  listTokens,
  regenerateToken,
  revokeToken,
  type ProjectTokenCreated,
} from '../api/tokens'
import { ArrowLeftIcon } from '../components/icons/ArrowLeftIcon'

function shareUrlFor(projectId: number, rawToken: string): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}#/projects/${projectId}?t=${rawToken}`
}

export function ProjectTokens() {
  const { projectId } = useParams()
  const id = Number(projectId)
  const queryClient = useQueryClient()

  const membersQuery = useQuery({ queryKey: ['members', id], queryFn: () => listMembers(id) })
  const tokensQuery = useQuery({ queryKey: ['tokens', id], queryFn: () => listTokens(id) })

  const [personName, setPersonName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'editor' | 'viewer'>('editor')
  const [revealedLink, setRevealedLink] = useState<ProjectTokenCreated | null>(null)
  const [inviteNotice, setInviteNotice] = useState<string | null>(null)

  const invalidateMembers = () => queryClient.invalidateQueries({ queryKey: ['members', id] })
  const invalidateTokens = () => queryClient.invalidateQueries({ queryKey: ['tokens', id] })

  const inviteMemberMutation = useMutation({
    mutationFn: () => inviteMember(id, { person_name: personName, email, role }),
    onSuccess: (member) => {
      setInviteNotice(`Invito inviato via email a ${member.email}.`)
      setPersonName('')
      setEmail('')
      invalidateMembers()
    },
  })

  const createTokenMutation = useMutation({
    mutationFn: () => createToken(id, { person_name: personName, role }),
    onSuccess: (token) => {
      setRevealedLink(token)
      setPersonName('')
      invalidateTokens()
    },
  })

  const resetPasswordMutation = useMutation({
    mutationFn: (projectMemberId: number) => resetMemberPassword(id, projectMemberId),
    onSuccess: (member) => {
      setInviteNotice(`Nuova password provvisoria inviata via email a ${member.email}.`)
      invalidateMembers()
    },
  })

  const removeMemberMutation = useMutation({
    mutationFn: (projectMemberId: number) => removeMember(id, projectMemberId),
    onSuccess: () => invalidateMembers(),
  })

  const regenerateTokenMutation = useMutation({
    mutationFn: (tokenId: number) => regenerateToken(id, tokenId),
    onSuccess: (token) => {
      setRevealedLink(token)
      invalidateTokens()
    },
  })

  const revokeTokenMutation = useMutation({
    mutationFn: (tokenId: number) => revokeToken(id, tokenId),
    onSuccess: () => invalidateTokens(),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setInviteNotice(null)
    setRevealedLink(null)
    if (email.trim()) {
      inviteMemberMutation.mutate()
    } else {
      createTokenMutation.mutate()
    }
  }

  const isPending = inviteMemberMutation.isPending || createTokenMutation.isPending

  return (
    <div>
      <p>
        <Link to={`/projects/${id}`} className="btn">
          <ArrowLeftIcon />
          Torna al calendario
        </Link>
      </p>
      <h1>Gestisci persone</h1>
      <p className="muted">
        Con l'email, la persona ottiene un account con password personale. Senza email, riceve un link
        anonimo da usare direttamente, senza login.
      </p>

      <form className="card" onSubmit={handleSubmit}>
        <h2>Invita una persona</h2>
        <div className="form-row">
          <label>
            Nome
            <input required value={personName} onChange={(e) => setPersonName(e.target.value)} placeholder="Marco" />
          </label>
          <label>
            Email (opzionale — con email: account con password)
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
        <button type="submit" className="primary" disabled={isPending}>
          {isPending ? 'Creazione...' : email.trim() ? 'Invita via email' : 'Genera link'}
        </button>

        {inviteNotice && <p className="share-link-box">{inviteNotice}</p>}
        {revealedLink && (
          <div className="share-link-box">
            <p>Copia e invia questo link (mostrato una sola volta):</p>
            <code>{shareUrlFor(id, revealedLink.raw_token)}</code>
          </div>
        )}
      </form>

      <h2>Persone con account (email + password)</h2>
      <div className="table-scroll">
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
          {membersQuery.data?.map((m) => (
            <tr key={m.id}>
              <td>{m.display_name}</td>
              <td>{m.email}</td>
              <td>{m.role === 'editor' ? 'Editor' : 'Sola lettura'}</td>
              <td>{m.must_change_password ? 'In attesa del primo accesso' : 'Attivo'}</td>
              <td className="actions">
                <button
                  type="button"
                  onClick={() => resetPasswordMutation.mutate(m.id)}
                  disabled={resetPasswordMutation.isPending}
                >
                  Reimposta password
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={() => removeMemberMutation.mutate(m.id)}
                  disabled={removeMemberMutation.isPending}
                >
                  Rimuovi accesso
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      {membersQuery.data?.length === 0 && <p className="muted">Nessuna persona con account ancora.</p>}

      <h2 style={{ marginTop: 28 }}>Link anonimi (senza email)</h2>
      <div className="table-scroll">
      <table className="tokens-table">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Ruolo</th>
            <th>Stato</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {tokensQuery.data?.map((t) => (
            <tr key={t.id} className={t.revoked_at ? 'revoked' : ''}>
              <td>{t.person_name}</td>
              <td>{t.role === 'editor' ? 'Editor' : 'Sola lettura'}</td>
              <td>{t.revoked_at ? 'Revocato' : 'Attivo'}</td>
              <td className="actions">
                <button
                  type="button"
                  onClick={() => regenerateTokenMutation.mutate(t.id)}
                  disabled={regenerateTokenMutation.isPending}
                >
                  Rigenera link
                </button>
                {!t.revoked_at && (
                  <button
                    type="button"
                    className="danger"
                    onClick={() => revokeTokenMutation.mutate(t.id)}
                    disabled={revokeTokenMutation.isPending}
                  >
                    Revoca
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      {tokensQuery.data?.length === 0 && <p className="muted">Nessun link anonimo ancora.</p>}
    </div>
  )
}
