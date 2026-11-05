import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { setActivityDone, type Activity } from '../api/activities'
import { listPeople } from '../api/people'
import { getProjectAccess } from '../api/projects'
import { canEditRole } from '../lib/roles'

// Responsabili di un'attività con lo stato "fatto": ognuno segna la propria parte, l'editor anche quella degli altri.
export function ActivityAssignees({ projectId, activity }: { projectId: number; activity: Activity }) {
  const queryClient = useQueryClient()
  const peopleQuery = useQuery({ queryKey: ['people', projectId], queryFn: () => listPeople(projectId) })
  const accessQuery = useQuery({ queryKey: ['access', projectId], queryFn: () => getProjectAccess(projectId) })
  const doneMutation = useMutation({
    mutationFn: (v: { ref: string; done: boolean }) => setActivityDone(projectId, activity.id, v.done, v.ref),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities', projectId] })
      queryClient.invalidateQueries({ queryKey: ['activity', projectId, activity.id] })
    },
    onError: (err) => alert(err instanceof Error ? err.message : 'Errore durante il salvataggio'),
  })

  if (activity.assignees.length === 0) return null
  const myRef = accessQuery.data?.ref
  const canAll = canEditRole(accessQuery.data?.role)
  const people = peopleQuery.data ?? []

  return (
    <div style={{ margin: '12px 0' }}>
      <strong>Responsabili</strong>
      <ul style={{ listStyle: 'none', padding: 0, margin: '6px 0 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {activity.assignees.map((ref) => {
          const done = (activity.done_refs ?? []).includes(ref)
          const name = people.find((p) => p.ref === ref)?.name ?? '(rimosso)'
          const mine = ref === myRef
          return (
            <li key={ref} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span aria-hidden="true">{done ? '✅' : '⬜'}</span>
              <span style={{ opacity: done ? 0.7 : 1 }}>
                {name}
                {mine && ' (tu)'} — {done ? 'fatto' : 'da fare'}
              </span>
              {(mine || canAll) && (
                <button
                  type="button"
                  className={mine && !done ? 'primary' : ''}
                  disabled={doneMutation.isPending}
                  onClick={() => doneMutation.mutate({ ref, done: !done })}
                >
                  {done ? 'Riapri' : mine ? 'Segna come fatta' : 'Segna fatta'}
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
