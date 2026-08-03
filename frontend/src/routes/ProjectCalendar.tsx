import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  createActivity,
  deleteActivity,
  listActivities,
  updateActivity,
  type Activity,
  type ActivityInput,
} from '../api/activities'
import { getProject, getProjectAccess } from '../api/projects'
import { ActivityEditorModal } from '../components/ActivityEditorModal'
import { DayColumn } from '../components/calendar/DayColumn'
import { TimeAxis } from '../components/calendar/TimeAxis'
import { toIsoDatetime } from '../components/calendar/time'
import { Spinner } from '../components/Spinner'
import { useProjectAccessStore } from '../state/projectAccessStore'

function toDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function dateRange(start: string, end: string): string[] {
  const dates: string[] = []
  const cursor = new Date(start + 'T00:00:00')
  const last = new Date(end + 'T00:00:00')
  while (cursor <= last) {
    dates.push(toDateString(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return dates
}

type EditorState =
  | { mode: 'create'; date: string; startAt: string; endAt: string }
  | { mode: 'edit'; activity: Activity }
  | null

export function ProjectCalendar() {
  const { projectId } = useParams()
  const id = Number(projectId)
  const [searchParams, setSearchParams] = useSearchParams()
  const setToken = useProjectAccessStore((s) => s.setToken)
  const queryClient = useQueryClient()
  const [editorState, setEditorState] = useState<EditorState>(null)

  useEffect(() => {
    const shareToken = searchParams.get('t')
    if (shareToken) {
      setToken(id, shareToken)
      searchParams.delete('t')
      setSearchParams(searchParams, { replace: true })
    }
  }, [searchParams, setSearchParams, id, setToken])

  const projectQuery = useQuery({ queryKey: ['project', id], queryFn: () => getProject(id) })
  const accessQuery = useQuery({ queryKey: ['access', id], queryFn: () => getProjectAccess(id) })
  const activitiesQuery = useQuery({
    queryKey: ['activities', id],
    queryFn: () => listActivities(id),
    enabled: !!projectQuery.data,
  })

  const invalidateActivities = () => queryClient.invalidateQueries({ queryKey: ['activities', id] })

  const createMutation = useMutation({
    mutationFn: (input: ActivityInput) => createActivity(id, input),
    onSuccess: () => {
      invalidateActivities()
      setEditorState(null)
    },
    onError: (err) => alert(err instanceof Error ? err.message : 'Errore durante il salvataggio'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ activityId, input }: { activityId: number; input: ActivityInput }) =>
      updateActivity(id, activityId, input),
    onSuccess: () => {
      invalidateActivities()
      setEditorState(null)
    },
    onError: (err) => alert(err instanceof Error ? err.message : 'Errore durante il salvataggio'),
  })

  const deleteMutation = useMutation({
    mutationFn: (activityId: number) => deleteActivity(id, activityId),
    onSuccess: () => {
      invalidateActivities()
      setEditorState(null)
    },
    onError: (err) => alert(err instanceof Error ? err.message : 'Errore durante l\'eliminazione'),
  })

  if (projectQuery.isLoading) return <Spinner label="Caricamento progetto..." />
  if (projectQuery.error || !projectQuery.data) return <p role="alert">Progetto non trovato o accesso negato</p>

  const project = projectQuery.data
  const days = dateRange(project.start_date, project.end_date)
  const canEdit = accessQuery.data ? accessQuery.data.role !== 'viewer' : false
  const isOwner = accessQuery.data?.role === 'owner'

  return (
    <div>
      <h1>{project.name}</h1>
      <p>
        {project.start_date} → {project.end_date}
        {isOwner && (
          <>
            {' · '}
            <Link to={`/projects/${id}/tokens`}>Gestisci persone</Link>
          </>
        )}
      </p>
      <div className="calendar-scroll" style={{ display: 'flex' }}>
        <TimeAxis />
        {days.map((date) => (
          <DayColumn
            key={date}
            date={date}
            activities={activitiesQuery.data ?? []}
            canEdit={canEdit}
            onRequestCreate={(d, startMinutes, endMinutes) =>
              setEditorState({
                mode: 'create',
                date: d,
                startAt: toIsoDatetime(d, startMinutes),
                endAt: toIsoDatetime(d, endMinutes),
              })
            }
            onRequestEdit={(activity) => setEditorState({ mode: 'edit', activity })}
          />
        ))}
      </div>

      {editorState && (
        <ActivityEditorModal
          date={editorState.mode === 'create' ? editorState.date : editorState.activity.start_at.slice(0, 10)}
          initial={editorState.mode === 'edit' ? editorState.activity : undefined}
          defaultStartAt={editorState.mode === 'create' ? editorState.startAt : undefined}
          defaultEndAt={editorState.mode === 'create' ? editorState.endAt : undefined}
          canDelete={canEdit}
          onSave={(input) => {
            if (editorState.mode === 'create') {
              createMutation.mutate(input)
            } else {
              updateMutation.mutate({ activityId: editorState.activity.id, input })
            }
          }}
          onDelete={
            editorState.mode === 'edit'
              ? () => deleteMutation.mutate(editorState.activity.id)
              : undefined
          }
          onClose={() => setEditorState(null)}
        />
      )}
    </div>
  )
}
