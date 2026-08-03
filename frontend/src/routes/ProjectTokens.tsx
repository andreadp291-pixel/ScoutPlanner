import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { createToken, listTokens, revokeToken, type ProjectTokenCreated } from '../api/tokens'

export function ProjectTokens() {
  const { projectId } = useParams()
  const id = Number(projectId)
  const queryClient = useQueryClient()

  const tokensQuery = useQuery({ queryKey: ['tokens', id], queryFn: () => listTokens(id) })
  const [personName, setPersonName] = useState('')
  const [role, setRole] = useState<'editor' | 'viewer'>('editor')
  const [justCreated, setJustCreated] = useState<ProjectTokenCreated | null>(null)

  const createMutation = useMutation({
    mutationFn: () => createToken(id, { person_name: personName, role }),
    onSuccess: (token) => {
      setJustCreated(token)
      setPersonName('')
      queryClient.invalidateQueries({ queryKey: ['tokens', id] })
    },
  })

  const revokeMutation = useMutation({
    mutationFn: (tokenId: number) => revokeToken(id, tokenId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tokens', id] }),
  })

  const shareUrl = justCreated
    ? `${window.location.origin}${import.meta.env.BASE_URL}#/projects/${id}?t=${justCreated.raw_token}`
    : null

  return (
    <div>
      <p>
        <Link to={`/projects/${id}`}>← Torna al calendario</Link>
      </p>
      <h1>Gestisci persone e token</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          createMutation.mutate()
        }}
      >
        <label>
          Nome persona
          <input required value={personName} onChange={(e) => setPersonName(e.target.value)} />
        </label>
        <label>
          Ruolo
          <select value={role} onChange={(e) => setRole(e.target.value as 'editor' | 'viewer')}>
            <option value="editor">Editor (può modificare)</option>
            <option value="viewer">Sola lettura</option>
          </select>
        </label>
        <button type="submit">Genera token</button>
      </form>

      {shareUrl && (
        <p>
          Link di condivisione per <strong>{justCreated?.person_name}</strong> (mostrato una sola volta):
          <br />
          <code>{shareUrl}</code>
        </p>
      )}

      <h2>Token attivi</h2>
      <ul>
        {tokensQuery.data
          ?.filter((t) => !t.revoked_at)
          .map((t) => (
            <li key={t.id}>
              {t.person_name} — {t.role}
              <button onClick={() => revokeMutation.mutate(t.id)}>Revoca</button>
            </li>
          ))}
      </ul>
    </div>
  )
}
