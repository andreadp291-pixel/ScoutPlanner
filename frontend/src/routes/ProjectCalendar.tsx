import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { listActivities } from '../api/activities'
import { getProject } from '../api/projects'
import { DayColumn } from '../components/calendar/DayColumn'
import { useProjectAccessStore } from '../state/projectAccessStore'

function dateRange(start: string, end: string): string[] {
  const dates: string[] = []
  const cursor = new Date(start + 'T00:00:00')
  const last = new Date(end + 'T00:00:00')
  while (cursor <= last) {
    dates.push(cursor.toISOString().slice(0, 10))
    cursor.setDate(cursor.getDate() + 1)
  }
  return dates
}

export function ProjectCalendar() {
  const { projectId } = useParams()
  const id = Number(projectId)
  const [searchParams, setSearchParams] = useSearchParams()
  const setToken = useProjectAccessStore((s) => s.setToken)

  useEffect(() => {
    const shareToken = searchParams.get('t')
    if (shareToken) {
      setToken(id, shareToken)
      searchParams.delete('t')
      setSearchParams(searchParams, { replace: true })
    }
  }, [searchParams, setSearchParams, id, setToken])

  const projectQuery = useQuery({ queryKey: ['project', id], queryFn: () => getProject(id) })
  const activitiesQuery = useQuery({
    queryKey: ['activities', id],
    queryFn: () => listActivities(id),
    enabled: !!projectQuery.data,
  })

  if (projectQuery.isLoading) return <p>Caricamento progetto...</p>
  if (projectQuery.error || !projectQuery.data) return <p role="alert">Progetto non trovato o accesso negato</p>

  const project = projectQuery.data
  const days = dateRange(project.start_date, project.end_date)

  return (
    <div>
      <h1>{project.name}</h1>
      <p>
        {project.start_date} → {project.end_date} · <Link to={`/projects/${id}/tokens`}>Gestisci persone</Link>
      </p>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
        {days.map((date) => (
          <DayColumn key={date} date={date} activities={activitiesQuery.data ?? []} />
        ))}
      </div>
    </div>
  )
}
