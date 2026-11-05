import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import {
  deleteForever,
  listHistory,
  listTrash,
  restoreFromTrash,
  restoreVersion,
  type HistoryEntry,
  type TrashItem,
} from '../api/history'
import { getProjectAccess } from '../api/projects'
import { ArrowLeftIcon } from '../components/icons/ArrowLeftIcon'
import { TrashIcon } from '../components/icons/TrashIcon'
import { Spinner } from '../components/Spinner'

const VERBS: Record<HistoryEntry['action'], string> = {
  create: 'ha creato',
  update: 'ha modificato',
  delete: 'ha eliminato',
  restore: 'ha ripristinato',
  purge: 'ha eliminato per sempre',
}

// il server dà l'ora UTC senza fuso: "2026-07-01 09:00:00"
const when = (s: string) =>
  new Date(s.replace(' ', 'T') + 'Z').toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

// Cronologia delle modifiche (con ripristino della versione precedente) e cestino a 30 giorni.
export function ProjectHistory() {
  const id = Number(useParams().projectId)
  const queryClient = useQueryClient()
  const historyQuery = useQuery({ queryKey: ['history', id], queryFn: () => listHistory(id) })
  const trashQuery = useQuery({ queryKey: ['trash', id], queryFn: () => listTrash(id) })
  const accessQuery = useQuery({ queryKey: ['access', id], queryFn: () => getProjectAccess(id) })
  const canEdit = accessQuery.data ? accessQuery.data.role !== 'viewer' : false

  const refresh = () => {
    for (const k of ['history', 'trash', 'activities', 'pages', 'materials']) queryClient.invalidateQueries({ queryKey: [k, id] })
  }
  const onError = (err: unknown) => alert(err instanceof Error ? err.message : 'Errore imprevisto')
  const versionMutation = useMutation({ mutationFn: (e: HistoryEntry) => restoreVersion(id, e.id), onSuccess: refresh, onError })
  const trashRestore = useMutation({ mutationFn: (t: TrashItem) => restoreFromTrash(id, t), onSuccess: refresh, onError })
  const trashDelete = useMutation({ mutationFn: (t: TrashItem) => deleteForever(id, t), onSuccess: refresh, onError })

  return (
    <div>
      <p>
        <Link to={`/projects/${id}/info`} className="btn">
          <ArrowLeftIcon />
          Torna alle info
        </Link>
      </p>
      <h1>Cronologia e cestino</h1>

      <div className="card">
        <h2>Cestino</h2>
        <p className="muted">Attività e pagine eliminate restano qui 30 giorni, poi spariscono per sempre.</p>
        {trashQuery.isLoading ? (
          <Spinner label="Caricamento..." />
        ) : trashQuery.data && trashQuery.data.length > 0 ? (
          <ul className="project-list">
            {trashQuery.data.map((t) => (
              <li key={`${t.entity}${t.id}`}>
                <span>
                  <strong>{t.title}</strong>{' '}
                  <span className="muted">
                    · {t.entity === 'page' ? 'pagina' : 'attività'}, eliminata {when(t.deleted_at)}
                  </span>
                </span>
                {canEdit && (
                  <span style={{ display: 'flex', gap: 8 }}>
                    <button type="button" onClick={() => trashRestore.mutate(t)} disabled={trashRestore.isPending}>
                      Recupera
                    </button>
                    <button
                      type="button"
                      aria-label="Elimina per sempre"
                      onClick={() => {
                        if (window.confirm(`Eliminare per sempre "${t.title}"?`)) trashDelete.mutate(t)
                      }}
                    >
                      <TrashIcon size={14} />
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Il cestino è vuoto.</p>
        )}
      </div>

      <div className="card">
        <h2>Cronologia</h2>
        {historyQuery.isLoading ? (
          <Spinner label="Caricamento..." />
        ) : historyQuery.data && historyQuery.data.length > 0 ? (
          <ul className="project-list">
            {historyQuery.data.map((e) => (
              <li key={e.id}>
                <span>
                  <strong>{e.actor}</strong> {VERBS[e.action]} <strong>{e.title}</strong>
                  {e.summary && <span className="muted"> ({e.summary})</span>}
                  <br />
                  <span className="muted">{when(e.created_at)}</span>
                </span>
                {canEdit && e.restorable && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Riportare "${e.title}" com'era prima di questa modifica?`)) versionMutation.mutate(e)
                    }}
                    disabled={versionMutation.isPending}
                  >
                    Ripristina
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Nessuna modifica registrata ancora.</p>
        )}
      </div>
    </div>
  )
}
