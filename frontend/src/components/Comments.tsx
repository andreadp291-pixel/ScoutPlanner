import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { addComment, deleteComment, listComments, resolveComment, type Comment } from '../api/collab'
import { getProjectAccess } from '../api/projects'
import { canEditRole } from '../lib/roles'
import { when } from '../lib/when'

interface CommentsProps {
  projectId: number
  entity: Comment['entity']
  entityId: number
}

function Composer({ placeholder, onSend, pending }: { placeholder: string; onSend: (body: string) => void; pending: boolean }) {
  const [body, setBody] = useState('')
  return (
    <form
      style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}
      onSubmit={(e) => {
        e.preventDefault()
        if (!body.trim()) return
        onSend(body)
        setBody('')
      }}
    >
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={placeholder}
        rows={2}
        maxLength={2000}
        style={{ flex: 1, minWidth: 0 }}
      />
      <button type="submit" className="primary" disabled={pending || !body.trim()}>
        Invia
      </button>
    </form>
  )
}

// Discussioni su un'attività o una pagina: commenti con risposte, da segnare come risolti.
// Scrive chi è almeno commentatore; la sola lettura vede soltanto.
export function Comments({ projectId, entity, entityId }: CommentsProps) {
  const queryClient = useQueryClient()
  const [replyTo, setReplyTo] = useState<number | null>(null)
  const key = ['comments', projectId, entity, entityId]
  const commentsQuery = useQuery({ queryKey: key, queryFn: () => listComments(projectId, entity, entityId) })
  const accessQuery = useQuery({ queryKey: ['access', projectId], queryFn: () => getProjectAccess(projectId) })
  const role = accessQuery.data?.role
  const canComment = role !== undefined && role !== 'viewer'
  const refresh = () => queryClient.invalidateQueries({ queryKey: key })
  const onError = (err: unknown) => alert(err instanceof Error ? err.message : 'Errore imprevisto')

  const addMutation = useMutation({
    mutationFn: (v: { body: string; parent?: number }) =>
      addComment(projectId, { entity, entity_id: entityId, body: v.body, parent_id: v.parent }),
    onSuccess: () => {
      setReplyTo(null)
      refresh()
    },
    onError,
  })
  const resolveMutation = useMutation({
    mutationFn: (c: Comment) => resolveComment(projectId, c.id, !c.resolved_at),
    onSuccess: refresh,
    onError,
  })
  const deleteMutation = useMutation({ mutationFn: (c: Comment) => deleteComment(projectId, c.id), onSuccess: refresh, onError })

  const all = commentsQuery.data ?? []
  const threads = all.filter((c) => c.parent_id === null)
  const canDelete = (c: Comment) => canEditRole(role) || c.author_ref === accessQuery.data?.ref

  function Item({ c, top }: { c: Comment; top: boolean }) {
    return (
      <div style={{ opacity: top && c.resolved_at ? 0.6 : 1 }}>
        <p style={{ margin: 0 }}>
          <strong>{c.author}</strong> <span className="muted">· {when(c.created_at)}</span>
          {top && c.resolved_at && <span className="muted"> · ✓ risolto</span>}
        </p>
        <p style={{ margin: '2px 0 4px', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{c.body}</p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {top && canComment && (
            <button type="button" className="link" onClick={() => setReplyTo(replyTo === c.id ? null : c.id)}>
              Rispondi
            </button>
          )}
          {top && canComment && (
            <button type="button" className="link" onClick={() => resolveMutation.mutate(c)}>
              {c.resolved_at ? 'Riapri' : 'Segna come risolto'}
            </button>
          )}
          {canDelete(c) && (
            <button
              type="button"
              className="link"
              onClick={() => {
                if (window.confirm(top ? 'Eliminare il commento e le sue risposte?' : 'Eliminare la risposta?')) deleteMutation.mutate(c)
              }}
            >
              Elimina
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="card" style={{ marginTop: 24 }}>
      <h2>Commenti{threads.length > 0 && ` (${threads.length})`}</h2>
      {commentsQuery.isLoading ? (
        <p className="muted">Caricamento...</p>
      ) : threads.length === 0 ? (
        <p className="muted">Nessun commento ancora.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 16 }}>
          {threads.map((t) => (
            <div key={t.id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Item c={t} top />
              {all
                .filter((r) => r.parent_id === t.id)
                .map((r) => (
                  <div key={r.id} style={{ marginLeft: 18, paddingLeft: 12, borderLeft: '2px solid var(--border)' }}>
                    <Item c={r} top={false} />
                  </div>
                ))}
              {replyTo === t.id && (
                <div style={{ marginLeft: 18 }}>
                  <Composer placeholder="Scrivi una risposta..." pending={addMutation.isPending} onSend={(body) => addMutation.mutate({ body, parent: t.id })} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {canComment ? (
        <Composer placeholder="Scrivi un commento..." pending={addMutation.isPending} onSend={(body) => addMutation.mutate({ body })} />
      ) : (
        <p className="muted">Con la sola lettura puoi leggere i commenti ma non scriverne.</p>
      )}
    </div>
  )
}
