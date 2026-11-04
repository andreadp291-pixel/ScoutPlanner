import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { Activity } from '../api/activities'
import { listActivities } from '../api/activities'
import { getProject } from '../api/projects'
import { ActivityQuickViewModal } from '../components/ActivityQuickViewModal'
import { ReadOnlyCalendar } from '../components/calendar/ReadOnlyCalendar'
import { dateRange, formatDayLabel } from '../components/calendar/time'
import { ArrowLeftIcon } from '../components/icons/ArrowLeftIcon'
import { Spinner } from '../components/Spinner'

export function ProjectFullCalendarView() {
  const { projectId } = useParams()
  const id = Number(projectId)
  const [quickViewActivity, setQuickViewActivity] = useState<Activity | null>(null)

  const projectQuery = useQuery({ queryKey: ['project', id], queryFn: () => getProject(id) })
  const activitiesQuery = useQuery({
    queryKey: ['activities', id],
    queryFn: () => listActivities(id),
    enabled: !!projectQuery.data,
  })

  if (projectQuery.isLoading) return <Spinner label="Caricamento progetto..." />
  if (projectQuery.error || !projectQuery.data) return <p role="alert">Progetto non trovato o accesso negato</p>

  const project = projectQuery.data

  return (
    <div>
      <p>
        <Link to={`/projects/${id}`} className="btn">
          <ArrowLeftIcon />
          Torna al progetto
        </Link>
      </p>
      <h1 style={{ marginBottom: 4 }}>{project.name}</h1>
      <p className="muted" style={{ marginBottom: 20 }}>
        {formatDayLabel(project.start_date)} → {formatDayLabel(project.end_date)}
      </p>

      <ReadOnlyCalendar
        days={dateRange(project.start_date, project.end_date)}
        activities={activitiesQuery.data ?? []}
        onActivityClick={setQuickViewActivity}
      />

      {quickViewActivity && (
        <ActivityQuickViewModal
          projectId={id}
          activity={quickViewActivity}
          onClose={() => setQuickViewActivity(null)}
        />
      )}
    </div>
  )
}
