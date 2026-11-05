import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { listActivities, type Activity } from '../api/activities'
import type { Person } from '../api/people'
import { ActivityAssignees } from './ActivityAssignees'
import { formatDayLabel, minutesSinceMidnight, minutesToHHMM } from './calendar/time'
import { LocationIcon } from './icons/LocationIcon'

interface ActivityQuickViewModalProps {
  projectId: number
  activity: Activity
  people: Person[]
  onClose: () => void
}

export function ActivityQuickViewModal({ projectId, activity: initial, onClose }: ActivityQuickViewModalProps) {
  const navigate = useNavigate()
  // la copia nella cache si aggiorna quando si segna "fatto"; quella ricevuta dal chiamante resterebbe vecchia
  const listQuery = useQuery({ queryKey: ['activities', projectId], queryFn: () => listActivities(projectId) })
  const activity = listQuery.data?.find((a) => a.id === initial.id) ?? initial

  const start = minutesToHHMM(minutesSinceMidnight(activity.start_at))
  const end = minutesToHHMM(minutesSinceMidnight(activity.end_at))

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <span className="poi-kind-badge" style={{ background: activity.color, color: '#fff' }}>
          {activity.category}
        </span>
        <h2 style={{ marginTop: 8 }}>{activity.title}</h2>
        <p className="muted">
          {formatDayLabel(activity.start_at.slice(0, 10))} · {start}–{end}
        </p>
        {activity.location && (
          <p>
            <LocationIcon size={15} /> {activity.location}
          </p>
        )}
        <ActivityAssignees projectId={projectId} activity={activity} />
        <div className="modal-actions">
          <div />
          <div className="modal-actions-primary">
            <button type="button" onClick={onClose}>
              Chiudi
            </button>
            <button
              type="button"
              className="primary"
              onClick={() => navigate(`/projects/${projectId}/activities/${activity.id}/description`)}
            >
              Vedi dettagli
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
