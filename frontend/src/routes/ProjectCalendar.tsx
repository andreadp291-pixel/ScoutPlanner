import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  createActivity,
  deleteActivity,
  listActivities,
  swapActivities,
  updateActivity,
  type Activity,
  type ActivityInput,
} from '../api/activities'
import { getProject, getProjectAccess } from '../api/projects'
import { createGroup, deleteGroup, listGroups, renameGroup } from '../api/groups'
import { ActivityEditorModal } from '../components/ActivityEditorModal'
import { GroupsManagerModal } from '../components/GroupsManagerModal'
import { DayColumn } from '../components/calendar/DayColumn'
import { TimeAxis } from '../components/calendar/TimeAxis'
import { dateRange, formatShortDate, minutesSinceMidnight, toIsoDatetime } from '../components/calendar/time'
import { DownloadIcon } from '../components/icons/DownloadIcon'
import { InfoIcon } from '../components/icons/InfoIcon'
import { ShareIcon } from '../components/icons/ShareIcon'
import { UploadIcon } from '../components/icons/UploadIcon'
import { UsersIcon } from '../components/icons/UsersIcon'
import { Spinner } from '../components/Spinner'
import { useProjectAccessStore } from '../state/projectAccessStore'

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
  const [dragHoverDate, setDragHoverDate] = useState<string | null>(null)
  const [swapTargetId, setSwapTargetId] = useState<number | null>(null)
  const [showGroupsManager, setShowGroupsManager] = useState(false)
  const importInputRef = useRef<HTMLInputElement>(null)

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
  const groupsQuery = useQuery({
    queryKey: ['groups', id],
    queryFn: () => listGroups(id),
    enabled: !!projectQuery.data,
  })

  const invalidateActivities = () => queryClient.invalidateQueries({ queryKey: ['activities', id] })
  const invalidateGroups = () => queryClient.invalidateQueries({ queryKey: ['groups', id] })

  const createGroupMutation = useMutation({
    mutationFn: (name: string) => createGroup(id, name),
    onSuccess: invalidateGroups,
    onError: (err) => alert(err instanceof Error ? err.message : 'Errore durante la creazione del gruppo'),
  })

  const renameGroupMutation = useMutation({
    mutationFn: ({ groupId, name }: { groupId: number; name: string }) => renameGroup(id, groupId, name),
    onSuccess: invalidateGroups,
    onError: (err) => alert(err instanceof Error ? err.message : 'Errore durante la rinomina del gruppo'),
  })

  const deleteGroupMutation = useMutation({
    mutationFn: (groupId: number) => deleteGroup(id, groupId),
    onSuccess: () => {
      invalidateGroups()
      invalidateActivities()
    },
    onError: (err) => alert(err instanceof Error ? err.message : "Errore durante l'eliminazione del gruppo"),
  })

  const createMutation = useMutation({
    mutationFn: (input: ActivityInput) => createActivity(id, input),
    onSuccess: () => {
      invalidateActivities()
      setEditorState(null)
    },
    onError: (err) => alert(err instanceof Error ? err.message : 'Errore durante il salvataggio'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ activityId, input }: { activityId: number; input: Partial<ActivityInput> }) =>
      updateActivity(id, activityId, input),
    onSuccess: () => {
      invalidateActivities()
      setEditorState(null)
    },
    onError: (err) => alert(err instanceof Error ? err.message : 'Errore durante il salvataggio'),
  })

  const moveMutation = useMutation({
    mutationFn: ({ activityId, input }: { activityId: number; input: Partial<ActivityInput> }) =>
      updateActivity(id, activityId, input),
    onSuccess: invalidateActivities,
    onError: (err) => alert(err instanceof Error ? err.message : 'Errore durante lo spostamento'),
  })
  // Nota: mutazione separata da updateMutation perché quest'ultima resetta editorState
  // al successo (adatto quando il modal è aperto), mentre move/resize avvengono col
  // modal chiuso e non devono toccare editorState.

  const deleteMutation = useMutation({
    mutationFn: (activityId: number) => deleteActivity(id, activityId),
    onSuccess: () => {
      invalidateActivities()
      setEditorState(null)
    },
    onError: (err) => alert(err instanceof Error ? err.message : 'Errore durante l\'eliminazione'),
  })

  const duplicateMutation = useMutation({
    mutationFn: async (entries: ActivityInput[]) => {
      for (const input of entries) await createActivity(id, input)
    },
    onSuccess: () => {
      invalidateActivities()
      setEditorState(null)
    },
    onError: (err) => {
      invalidateActivities()
      alert(err instanceof Error ? err.message : 'Errore durante la duplicazione')
    },
  })

  const swapMutation = useMutation({
    mutationFn: ({ idA, idB }: { idA: number; idB: number }) => swapActivities(id, idA, idB),
    onSuccess: invalidateActivities,
    onError: (err) => alert(err instanceof Error ? err.message : 'Errore durante lo scambio'),
  })

  const importMutation = useMutation({
    mutationFn: async (imported: ActivityInput[]) => {
      for (const input of imported) await createActivity(id, input)
    },
    onSuccess: invalidateActivities,
    onError: (err) => {
      invalidateActivities()
      alert(err instanceof Error ? err.message : 'Errore durante l\'importazione')
    },
  })

  function handleExport() {
    const blob = new Blob([JSON.stringify(activitiesQuery.data ?? [], null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `calendario-${project?.name ?? id}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    file
      .text()
      .then((text) => {
        const parsed = JSON.parse(text)
        if (!Array.isArray(parsed)) throw new Error('Il file deve contenere un array di eventi')
        const inputs: ActivityInput[] = parsed.map((entry) => ({
          title: entry.title,
          description: entry.description ?? '',
          location: entry.location ?? '',
          category: entry.category ?? 'attivita',
          color: entry.color,
          materials: entry.materials ?? '',
          start_at: entry.start_at,
          end_at: entry.end_at,
        }))
        importMutation.mutate(inputs)
      })
      .catch((err) => alert(err instanceof Error ? err.message : 'File non valido'))
  }

  if (projectQuery.isLoading) return <Spinner label="Caricamento progetto..." />
  if (projectQuery.error || !projectQuery.data) return <p role="alert">Progetto non trovato o accesso negato</p>

  const project = projectQuery.data
  const days = dateRange(project.start_date, project.end_date)
  const canEdit = accessQuery.data ? accessQuery.data.role !== 'viewer' : false
  const isOwner = accessQuery.data?.role === 'owner'

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>
          <h1 style={{ marginBottom: 4 }}>{project.name}</h1>
          <p className="muted">
            {formatShortDate(project.start_date)} → {formatShortDate(project.end_date)}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Link to={`/projects/${id}/info`}>
            <button type="button">
              <InfoIcon />
              Info generali
            </button>
          </Link>
          <button type="button" onClick={handleExport}>
            <DownloadIcon />
            Esporta
          </button>
          {canEdit && (
            <>
              <input
                ref={importInputRef}
                type="file"
                accept="application/json"
                onChange={handleImportFile}
                style={{ display: 'none' }}
              />
              <button type="button" onClick={() => importInputRef.current?.click()}>
                <UploadIcon />
                Importa
              </button>
            </>
          )}
          {canEdit && (
            <button type="button" onClick={() => setShowGroupsManager(true)}>
              <UsersIcon />
              Gruppi
            </button>
          )}
          {isOwner && (
            <Link to={`/projects/${id}/tokens`}>
              <button
                type="button"
                className="primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
              >
                <ShareIcon />
                Gestisci persone
              </button>
            </Link>
          )}
        </div>
      </div>
      <div className="calendar-scroll" style={{ display: 'flex' }}>
        <TimeAxis />
        {days.map((date) => (
          <DayColumn
            key={date}
            date={date}
            activities={activitiesQuery.data ?? []}
            canEdit={canEdit}
            isDropTarget={dragHoverDate === date}
            swapTargetId={swapTargetId}
            onDragHoverDate={setDragHoverDate}
            onSwapHoverId={setSwapTargetId}
            onRequestCreate={(d, startMinutes, endMinutes) =>
              setEditorState({
                mode: 'create',
                date: d,
                startAt: toIsoDatetime(d, startMinutes),
                endAt: toIsoDatetime(d, endMinutes),
              })
            }
            onRequestEdit={(activity) => setEditorState({ mode: 'edit', activity })}
            onRequestMove={(activity, newDate, newStartMinutes) => {
              const duration = minutesSinceMidnight(activity.end_at) - minutesSinceMidnight(activity.start_at)
              moveMutation.mutate({
                activityId: activity.id,
                input: {
                  start_at: toIsoDatetime(newDate, newStartMinutes),
                  end_at: toIsoDatetime(newDate, newStartMinutes + duration),
                },
              })
            }}
            onRequestResize={(activity, newEndMinutes) => {
              const activityDate = activity.start_at.slice(0, 10)
              moveMutation.mutate({
                activityId: activity.id,
                input: { end_at: toIsoDatetime(activityDate, newEndMinutes) },
              })
            }}
            onRequestSwap={(activity, targetActivityId) =>
              swapMutation.mutate({ idA: activity.id, idB: targetActivityId })
            }
          />
        ))}
      </div>

      {showGroupsManager && (
        <GroupsManagerModal
          groups={groupsQuery.data ?? []}
          onCreate={(name) => createGroupMutation.mutate(name)}
          onRename={(groupId, name) => renameGroupMutation.mutate({ groupId, name })}
          onDelete={(groupId) => deleteGroupMutation.mutate(groupId)}
          onClose={() => setShowGroupsManager(false)}
        />
      )}

      {editorState && (
        <ActivityEditorModal
          projectId={id}
          date={editorState.mode === 'create' ? editorState.date : editorState.activity.start_at.slice(0, 10)}
          initial={editorState.mode === 'edit' ? editorState.activity : undefined}
          defaultStartAt={editorState.mode === 'create' ? editorState.startAt : undefined}
          defaultEndAt={editorState.mode === 'create' ? editorState.endAt : undefined}
          projectStartDate={project.start_date}
          projectEndDate={project.end_date}
          canDelete={canEdit}
          groups={groupsQuery.data ?? []}
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
          onDuplicate={
            editorState.mode === 'edit'
              ? (entries) => {
                  const a = editorState.activity
                  duplicateMutation.mutate(
                    entries.map(({ startAt, endAt }) => ({
                      title: a.title,
                      description: a.description,
                      location: a.location,
                      category: a.category,
                      color: a.color,
                      materials: a.materials,
                      group_ids: a.group_ids,
                      start_at: startAt,
                      end_at: endAt,
                    })),
                  )
                }
              : undefined
          }
          onClose={() => setEditorState(null)}
        />
      )}
    </div>
  )
}
