import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { JSONContent } from '@tiptap/react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getActivity, updateActivity } from '../api/activities'
import { getProjectAccess } from '../api/projects'
import { RichTextEditor } from '../components/editor/RichTextEditor'
import { ArrowLeftIcon } from '../components/icons/ArrowLeftIcon'
import { Spinner } from '../components/Spinner'

function parseDescription(raw: string | undefined): JSONContent | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as JSONContent
  } catch {
    return null
  }
}

export function ActivityDescription() {
  const { projectId, activityId } = useParams()
  const id = Number(projectId)
  const actId = Number(activityId)
  const queryClient = useQueryClient()
  const [pendingContent, setPendingContent] = useState<JSONContent | null>(null)
  const [materials, setMaterials] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')

  const accessQuery = useQuery({ queryKey: ['access', id], queryFn: () => getProjectAccess(id) })
  const activityQuery = useQuery({
    queryKey: ['activity', id, actId],
    queryFn: () => getActivity(id, actId),
  })

  const saveMutation = useMutation({
    mutationFn: (content: JSONContent) =>
      updateActivity(id, actId, { description: JSON.stringify(content) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity', id, actId] })
      queryClient.invalidateQueries({ queryKey: ['activities', id] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
    onError: (err) => alert(err instanceof Error ? err.message : 'Errore durante il salvataggio'),
  })

  const saveMaterialsMutation = useMutation({
    mutationFn: (value: string) => updateActivity(id, actId, { materials: value }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity', id, actId] })
      queryClient.invalidateQueries({ queryKey: ['activities', id] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
    onError: (err) => alert(err instanceof Error ? err.message : 'Errore durante il salvataggio'),
  })

  if (activityQuery.isLoading) return <Spinner label="Caricamento attività..." />
  if (activityQuery.error || !activityQuery.data) {
    return <p role="alert">Attività non trovata o accesso negato</p>
  }

  const activity = activityQuery.data
  const canEdit = accessQuery.data ? accessQuery.data.role !== 'viewer' : false
  const currentContent = pendingContent ?? parseDescription(activity.description)
  const currentMaterials = materials ?? activity.materials

  return (
    <div>
      <p>
        <Link to={`/projects/${id}`} className="btn">
          <ArrowLeftIcon />
          Torna al calendario
        </Link>
      </p>
      <h1 style={{ marginBottom: 4 }}>{activity.title}</h1>
      <p className="muted" style={{ marginBottom: 20 }}>
        {activity.start_at.slice(0, 10)} · {activity.start_at.slice(11, 16)}–{activity.end_at.slice(11, 16)}
      </p>

      {canEdit && (
        <div className="editor-mode-tabs">
          <button
            type="button"
            className={mode === 'edit' ? 'active' : ''}
            onClick={() => setMode('edit')}
          >
            Modifica
          </button>
          <button
            type="button"
            className={mode === 'preview' ? 'active' : ''}
            onClick={() => setMode('preview')}
          >
            Anteprima
          </button>
        </div>
      )}

      <RichTextEditor
        key={mode}
        projectId={id}
        content={currentContent}
        editable={canEdit && mode === 'edit'}
        onChange={setPendingContent}
      />

      <form onSubmit={(e) => e.preventDefault()} style={{ marginTop: 20 }}>
        <label>
          Materiali
          <textarea
            rows={3}
            placeholder="Es. corda, torcia, cerini…"
            value={currentMaterials}
            disabled={!canEdit}
            onChange={(e) => setMaterials(e.target.value)}
          />
        </label>
      </form>

      {canEdit && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
          <button
            type="button"
            className="primary"
            onClick={() => {
              if (pendingContent) saveMutation.mutate(pendingContent)
              if (materials !== null) saveMaterialsMutation.mutate(materials)
            }}
            disabled={
              (saveMutation.isPending || saveMaterialsMutation.isPending) ||
              (!pendingContent && materials === null)
            }
          >
            {saveMutation.isPending || saveMaterialsMutation.isPending ? 'Salvataggio...' : 'Salva'}
          </button>
          {saved && <span className="muted">Salvato ✓</span>}
        </div>
      )}
    </div>
  )
}
