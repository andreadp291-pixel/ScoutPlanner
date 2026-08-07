import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import type { Activity } from '../api/activities'
import { listActivities } from '../api/activities'
import { listPages } from '../api/pages'
import { getProject } from '../api/projects'
import { ActivityQuickViewModal } from '../components/ActivityQuickViewModal'
import { dateRange, formatDayLabel, minutesSinceMidnight, minutesToHHMM, nowMinutes, todayDateString } from '../components/calendar/time'
import { ReadOnlyCalendar } from '../components/calendar/ReadOnlyCalendar'
import { BlockEditor } from '../components/editor/BlockEditor'
import { parseActivityDoc } from '../components/editor/blocks'
import { CalendarIcon } from '../components/icons/CalendarIcon'
import { ChevronDownIcon } from '../components/icons/ChevronDownIcon'
import { ChevronUpIcon } from '../components/icons/ChevronUpIcon'
import { InfoIcon } from '../components/icons/InfoIcon'
import { Spinner } from '../components/Spinner'
import { useProjectAccessStore } from '../state/projectAccessStore'

export function ProjectView() {
  const { projectId } = useParams()
  const id = Number(projectId)
  const [searchParams, setSearchParams] = useSearchParams()
  const setToken = useProjectAccessStore((s) => s.setToken)
  const [dayExpanded, setDayExpanded] = useState(false)
  const [quickViewActivity, setQuickViewActivity] = useState<Activity | null>(null)

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
  const pagesQuery = useQuery({
    queryKey: ['pages', id],
    queryFn: () => listPages(id),
    enabled: !!projectQuery.data,
  })

  if (projectQuery.isLoading) return <Spinner label="Caricamento progetto..." />
  if (projectQuery.error || !projectQuery.data) return <p role="alert">Progetto non trovato o accesso negato</p>

  const project = projectQuery.data
  const activities = activitiesQuery.data ?? []
  const today = todayDateString()
  const isCampToday = dateRange(project.start_date, project.end_date).includes(today)

  const todayActivities = activities.filter((a) => a.start_at.startsWith(today))
  const now = nowMinutes()
  const currentActivity = todayActivities.find(
    (a) => minutesSinceMidnight(a.start_at) <= now && now <= minutesSinceMidnight(a.end_at),
  )
  const nextActivity = todayActivities
    .filter((a) => minutesSinceMidnight(a.start_at) > now)
    .sort((a, b) => minutesSinceMidnight(a.start_at) - minutesSinceMidnight(b.start_at))[0]

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div>
          <h1 style={{ marginBottom: 4 }}>{project.name}</h1>
          <p className="muted">
            {formatDayLabel(project.start_date)} → {formatDayLabel(project.end_date)}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link to={`/projects/${id}/calendar`}>
            <button type="button">
              <CalendarIcon /> Calendario completo
            </button>
          </Link>
          <Link to={`/projects/${id}/info`}>
            <button type="button">
              <InfoIcon /> Info generali
            </button>
          </Link>
        </div>
      </div>

      {isCampToday ? (
        <>
          <button
            type="button"
            className="current-activity-bar"
            onClick={() => setDayExpanded((v) => !v)}
          >
            <div>
              {currentActivity ? (
                <>
                  <strong>{currentActivity.title}</strong>
                  <span className="muted">
                    {' '}
                    · {minutesToHHMM(minutesSinceMidnight(currentActivity.start_at))}–
                    {minutesToHHMM(minutesSinceMidnight(currentActivity.end_at))}
                  </span>
                </>
              ) : (
                <>
                  <strong>Nessuna attività in corso</strong>
                  {nextActivity && (
                    <span className="muted">
                      {' '}
                      · Prossima: {nextActivity.title} alle{' '}
                      {minutesToHHMM(minutesSinceMidnight(nextActivity.start_at))}
                    </span>
                  )}
                </>
              )}
            </div>
            {dayExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
          </button>

          {dayExpanded && (
            <div style={{ marginTop: 12 }}>
              <ReadOnlyCalendar
                days={[today]}
                activities={activities}
                onActivityClick={setQuickViewActivity}
              />
            </div>
          )}

          {currentActivity && (
            <div style={{ marginTop: 20 }}>
              <BlockEditor
                projectId={id}
                content={parseActivityDoc(currentActivity.description)}
                editable={false}
              />
              {currentActivity.materials && (
                <div className="card" style={{ marginTop: 12 }}>
                  <h2>Materiali</h2>
                  <p style={{ whiteSpace: 'pre-wrap' }}>{currentActivity.materials}</p>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          <ReadOnlyCalendar
            days={dateRange(project.start_date, project.end_date)}
            activities={activities}
            onActivityClick={setQuickViewActivity}
          />

          <div className="card" style={{ marginTop: 20 }}>
            <h2>Pagine</h2>
            {pagesQuery.data && pagesQuery.data.length > 0 ? (
              <ul className="project-list">
                {pagesQuery.data.map((page) => (
                  <li key={page.id}>
                    <Link to={`/projects/${id}/pages/${page.id}`}>{page.title}</Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">Nessuna pagina ancora.</p>
            )}
          </div>
        </>
      )}

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
