import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { listGroups } from '../api/groups'
import { getPage, updatePage } from '../api/pages'
import { getProject, getProjectAccess } from '../api/projects'
import { BlockEditor } from '../components/editor/BlockEditor'
import type { ActivityDoc } from '../components/editor/blocks'
import { parseActivityDoc } from '../components/editor/blocks'
import { dateRange, formatShortDate } from '../components/calendar/time'
import { ArrowLeftIcon } from '../components/icons/ArrowLeftIcon'
import { Spinner } from '../components/Spinner'
import { useViewModeStore } from '../state/viewModeStore'

export function ProjectPageEditor() {
  const { projectId, pageId } = useParams()
  const id = Number(projectId)
  const pid = Number(pageId)
  const queryClient = useQueryClient()
  const globalMode = useViewModeStore((s) => s.mode)
  const [pendingContent, setPendingContent] = useState<ActivityDoc | null>(null)
  const [title, setTitle] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')

  const accessQuery = useQuery({ queryKey: ['access', id], queryFn: () => getProjectAccess(id) })
  const projectQuery = useQuery({ queryKey: ['project', id], queryFn: () => getProject(id) })
  const groupsQuery = useQuery({ queryKey: ['groups', id], queryFn: () => listGroups(id) })
  const pageQuery = useQuery({ queryKey: ['page', id, pid], queryFn: () => getPage(id, pid) })

  const saveMutation = useMutation({
    mutationFn: (input: { title?: string; content?: string }) => updatePage(id, pid, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['page', id, pid] })
      queryClient.invalidateQueries({ queryKey: ['pages', id] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
    onError: (err) => alert(err instanceof Error ? err.message : 'Errore durante il salvataggio'),
  })

  if (pageQuery.isLoading) return <Spinner label="Caricamento pagina..." />
  if (pageQuery.error || !pageQuery.data) {
    return <p role="alert">Pagina non trovata o accesso negato</p>
  }

  const page = pageQuery.data
  const canEdit = (accessQuery.data ? accessQuery.data.role !== 'viewer' : false) && globalMode === 'edit'
  const currentContent = pendingContent ?? parseActivityDoc(page.content)
  const currentTitle = title ?? page.title
  const presetDays = projectQuery.data
    ? dateRange(projectQuery.data.start_date, projectQuery.data.end_date).map(formatShortDate)
    : []

  return (
    <div>
      <p>
        <Link to={`/projects/${id}/info`} className="btn">
          <ArrowLeftIcon />
          Torna a Info generali
        </Link>
      </p>

      {canEdit ? (
        <input
          className="block-title-input"
          style={{ marginBottom: 20, fontSize: 28 }}
          value={currentTitle}
          onChange={(e) => setTitle(e.target.value)}
        />
      ) : (
        <h1 style={{ marginBottom: 20 }}>{currentTitle}</h1>
      )}

      {canEdit && (
        <div className="editor-mode-tabs">
          <button type="button" className={mode === 'edit' ? 'active' : ''} onClick={() => setMode('edit')}>
            Modifica
          </button>
          <button type="button" className={mode === 'preview' ? 'active' : ''} onClick={() => setMode('preview')}>
            Anteprima
          </button>
        </div>
      )}

      <BlockEditor
        key={mode}
        projectId={id}
        content={currentContent}
        editable={canEdit && mode === 'edit'}
        onChange={setPendingContent}
        presetDays={presetDays}
        presetGroups={groupsQuery.data ?? []}
      />

      {canEdit && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
          <button
            type="button"
            className="primary"
            onClick={() =>
              saveMutation.mutate({
                title: title ?? undefined,
                content: pendingContent ? JSON.stringify(pendingContent) : undefined,
              })
            }
            disabled={saveMutation.isPending || (title === null && !pendingContent)}
          >
            {saveMutation.isPending ? 'Salvataggio...' : 'Salva'}
          </button>
          {saved && <span className="muted">Salvato ✓</span>}
        </div>
      )}
    </div>
  )
}
