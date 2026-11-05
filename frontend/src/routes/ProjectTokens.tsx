import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import {
  approveAccessRequest,
  listAccessRequests,
  rejectAccessRequest,
  sendReportNow,
  sendRemindersNow,
  transferOwnership,
} from '../api/collab'
import {
  inviteMember,
  listMembers,
  removeMember,
  resetMemberPassword,
  updateMemberRole,
} from '../api/members'
import {
  createToken,
  listTokens,
  regenerateToken,
  revokeToken,
  updateToken,
  type ProjectTokenCreated,
} from '../api/tokens'
import { ROLE_LABELS, type Role } from '../lib/roles'
import { when } from '../lib/when'
import { ArrowLeftIcon } from '../components/icons/ArrowLeftIcon'

const expired = (at: string | null) => at !== null && new Date(at.replace(' ', 'T') + 'Z') < new Date()

function shareUrlFor(projectId: number, rawToken: string): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}#/projects/${projectId}?t=${rawToken}`
}

export function ProjectTokens() {
  const { projectId } = useParams()
  const id = Number(projectId)
  const queryClient = useQueryClient()

  const membersQuery = useQuery({ queryKey: ['members', id], queryFn: () => listMembers(id) })
  const tokensQuery = useQuery({ queryKey: ['tokens', id], queryFn: () => listTokens(id) })
  const requestsQuery = useQuery({ queryKey: ['access-requests', id], queryFn: () => listAccessRequests(id) })

  const [personName, setPersonName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('editor')
  const [expiryDays, setExpiryDays] = useState('')
  const [transferEmail, setTransferEmail] = useState('')
  const [approveRole, setApproveRole] = useState<Record<number, Role>>({})
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
    mutationFn: () => createToken(id, { person_name: personName, role, expires_in_days: expiryDays ? Number(expiryDays) : undefined }),
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

  const memberRoleMutation = useMutation({
    mutationFn: (v: { pmId: number; role: Role }) => updateMemberRole(id, v.pmId, v.role),
    onSuccess: invalidateMembers,
  })
  const tokenUpdateMutation = useMutation({
    mutationFn: (v: { tokenId: number; role?: Role; expires_in_days?: number; no_expiry?: boolean }) =>
      updateToken(id, v.tokenId, { role: v.role, expires_in_days: v.expires_in_days, no_expiry: v.no_expiry }),
    onSuccess: invalidateTokens,
  })
  const answerRequestMutation = useMutation({
    mutationFn: (v: { reqId: number; approve: boolean }) =>
      v.approve ? approveAccessRequest(id, v.reqId, approveRole[v.reqId] ?? 'viewer') : rejectAccessRequest(id, v.reqId),
    onSuccess: (_r, v) => {
      if (v.approve) setInviteNotice('Accesso concesso: la persona riceve una email.')
      queryClient.invalidateQueries({ queryKey: ['access-requests', id] })
      invalidateMembers()
    },
  })
  const reportMutation = useMutation({
    mutationFn: () => sendReportNow(id),
    onSuccess: () => setInviteNotice('Report in partenza: chi ha attività assegnate lo riceve via email tra poco.'),
  })
  const remindMutation = useMutation({ mutationFn: () => sendRemindersNow(id) })
  const transferMutation = useMutation({
    mutationFn: () => transferOwnership(id, transferEmail),
    onSuccess: () => {
      alert('Progetto ceduto. Da ora lo gestisce la nuova persona e tu resti come editor: accedi con il tuo account per ritrovarlo.')
      window.location.hash = '#/projects'
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
            <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
              <option value="editor">Editor — può modificare</option>
              <option value="commenter">Commentatore — legge e commenta</option>
              <option value="viewer">Sola lettura</option>
            </select>
          </label>
          {!email.trim() && (
            <label>
              Il link scade
              <select value={expiryDays} onChange={(e) => setExpiryDays(e.target.value)}>
                <option value="">Mai</option>
                <option value="1">Tra 1 giorno</option>
                <option value="7">Tra 7 giorni</option>
                <option value="30">Tra 30 giorni</option>
              </select>
            </label>
          )}
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

      {requestsQuery.data && requestsQuery.data.length > 0 && (
        <div className="card">
          <h2>Richieste di accesso ({requestsQuery.data.length})</h2>
          {requestsQuery.data.map((r) => (
            <div key={r.id} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ flex: '1 1 220px', minWidth: 0, overflowWrap: 'anywhere' }}>
                <strong>{r.name}</strong>{' '}
                <span className="muted">
                  {r.email} · {when(r.created_at)}
                </span>
                {r.message && (
                  <>
                    <br />«{r.message}»
                  </>
                )}
              </span>
              <select
                value={approveRole[r.id] ?? 'viewer'}
                onChange={(e) => setApproveRole({ ...approveRole, [r.id]: e.target.value as Role })}
                aria-label="Ruolo da dare"
              >
                <option value="editor">Editor</option>
                <option value="commenter">Commentatore</option>
                <option value="viewer">Sola lettura</option>
              </select>
              <button
                type="button"
                className="primary"
                disabled={answerRequestMutation.isPending}
                onClick={() => answerRequestMutation.mutate({ reqId: r.id, approve: true })}
              >
                Approva
              </button>
              <button
                type="button"
                disabled={answerRequestMutation.isPending}
                onClick={() => answerRequestMutation.mutate({ reqId: r.id, approve: false })}
              >
                Rifiuta
              </button>
            </div>
          ))}
          {answerRequestMutation.error && <p style={{ color: 'var(--danger)' }}>{answerRequestMutation.error.message}</p>}
        </div>
      )}

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
              <td>
                <select
                  value={m.role}
                  aria-label={`Ruolo di ${m.display_name}`}
                  disabled={memberRoleMutation.isPending}
                  onChange={(e) => memberRoleMutation.mutate({ pmId: m.id, role: e.target.value as Role })}
                >
                  {(['editor', 'commenter', 'viewer'] as Role[]).map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </td>
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
            <th>Scadenza</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {tokensQuery.data?.map((t) => (
            <tr key={t.id} className={t.revoked_at ? 'revoked' : ''}>
              <td>{t.person_name}</td>
              <td>
                <select
                  value={t.role}
                  aria-label={`Ruolo di ${t.person_name}`}
                  disabled={tokenUpdateMutation.isPending}
                  onChange={(e) => tokenUpdateMutation.mutate({ tokenId: t.id, role: e.target.value as Role })}
                >
                  {(['editor', 'commenter', 'viewer'] as Role[]).map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </td>
              <td>{t.revoked_at ? 'Revocato' : expired(t.expires_at) ? 'Scaduto' : 'Attivo'}</td>
              <td>
                <select
                  value=""
                  aria-label={`Scadenza di ${t.person_name}`}
                  disabled={tokenUpdateMutation.isPending}
                  onChange={(e) => {
                    const v = e.target.value
                    if (v)
                      tokenUpdateMutation.mutate(
                        v === 'never' ? { tokenId: t.id, no_expiry: true } : { tokenId: t.id, expires_in_days: Number(v) },
                      )
                  }}
                >
                  <option value="">{t.expires_at ? `Scade ${when(t.expires_at)}` : 'Non scade'}</option>
                  <option value="1">Scade tra 1 giorno</option>
                  <option value="7">Scade tra 7 giorni</option>
                  <option value="30">Scade tra 30 giorni</option>
                  <option value="never">Non scade mai</option>
                </select>
              </td>
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

      <div className="card" style={{ marginTop: 28 }}>
        <h2>Promemoria e report</h2>
        <p className="muted">
          Prima del campo, ogni 3 giorni, chi ha attività assegnate ancora da compilare riceve «ti mancano da compilare…» con i link;
          tu vedi anche chi manca. Durante il campo non parte nessuna email automatica. Il report (fatte, da fare, in ritardo)
          lo mandi tu, quando vuoi. Ognuno può disattivare i promemoria da «Notifiche email».
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => remindMutation.mutate()} disabled={remindMutation.isPending}>
            {remindMutation.isPending ? 'Invio...' : 'Invia ora i promemoria da compilare'}
          </button>
          <button type="button" onClick={() => reportMutation.mutate()} disabled={reportMutation.isPending}>
            {reportMutation.isPending ? 'Invio...' : 'Invia ora il report'}
          </button>
        </div>
        {(remindMutation.isSuccess || reportMutation.isSuccess) && <p className="share-link-box">In partenza: arriva via email tra poco.</p>}
      </div>

      <form
        className="card"
        style={{ marginTop: 28 }}
        onSubmit={(e) => {
          e.preventDefault()
          if (window.confirm(`Cedere il progetto a ${transferEmail}? Tu resterai editor.`)) transferMutation.mutate()
        }}
      >
        <h2>Cedi il progetto</h2>
        <p className="muted">Passa la proprietà a un'altra persona: potrà gestire persone e link. Tu resti come editor.</p>
        <div className="form-row">
          <label>
            Email del nuovo proprietario
            <input
              type="email"
              required
              value={transferEmail}
              onChange={(e) => setTransferEmail(e.target.value)}
              placeholder="capo@example.com"
            />
          </label>
        </div>
        <button type="submit" className="danger" disabled={transferMutation.isPending}>
          {transferMutation.isPending ? 'Cessione...' : 'Cedi il progetto'}
        </button>
        {transferMutation.error && <p style={{ color: 'var(--danger)' }}>{transferMutation.error.message}</p>}
      </form>
    </div>
  )
}
