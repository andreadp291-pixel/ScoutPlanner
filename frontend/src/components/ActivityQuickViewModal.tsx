import { useNavigate } from 'react-router-dom'
import type { Activity } from '../api/activities'
import { formatDayLabel, minutesSinceMidnight, minutesToHHMM } from './calendar/time'
import { LocationIcon } from './icons/LocationIcon'

interface ActivityQuickViewModalProps {
  projectId: number
  activity: Activity
  onClose: () => void
}

export function ActivityQuickViewModal({ projectId, activity, onClose }: ActivityQuickViewModalProps) {
  const navigate = useNavigate()

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
