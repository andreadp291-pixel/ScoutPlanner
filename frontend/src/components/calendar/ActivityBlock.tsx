import type { Activity } from '../../api/activities'
import { minutesSinceMidnight } from './time'

interface ActivityBlockProps {
  activity: Activity
  dayStartMinutes: number
  pxPerMinute: number
  onClick: () => void
}

export function ActivityBlock({ activity, dayStartMinutes, pxPerMinute, onClick }: ActivityBlockProps) {
  const startMinutes = minutesSinceMidnight(activity.start_at)
  const endMinutes = minutesSinceMidnight(activity.end_at)
  const top = (startMinutes - dayStartMinutes) * pxPerMinute
  const height = Math.max(1, (endMinutes - startMinutes) * pxPerMinute)

  return (
    <div
      className="activity-block"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      style={{
        position: 'absolute',
        top,
        height,
        left: 2,
        right: 2,
        background: activity.color,
        borderRadius: 4,
        padding: '2px 4px',
        fontSize: 12,
        overflow: 'hidden',
        cursor: 'pointer',
      }}
      title={`${activity.title} (${activity.start_at.slice(11)}–${activity.end_at.slice(11)})`}
    >
      {activity.title}
    </div>
  )
}
