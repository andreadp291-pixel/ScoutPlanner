import type { Activity } from '../../api/activities'

function minutesSinceMidnight(isoDatetime: string): number {
  const timePart = isoDatetime.split('T')[1] ?? '00:00'
  const [h, m] = timePart.split(':').map(Number)
  return h * 60 + m
}

interface ActivityBlockProps {
  activity: Activity
  dayStartMinutes: number
  pxPerMinute: number
}

export function ActivityBlock({ activity, dayStartMinutes, pxPerMinute }: ActivityBlockProps) {
  const startMinutes = minutesSinceMidnight(activity.start_at)
  const endMinutes = minutesSinceMidnight(activity.end_at)
  const top = (startMinutes - dayStartMinutes) * pxPerMinute
  const height = Math.max(1, (endMinutes - startMinutes) * pxPerMinute)

  return (
    <div
      className="activity-block"
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
      }}
      title={`${activity.title} (${activity.start_at.slice(11)}–${activity.end_at.slice(11)})`}
    >
      {activity.title}
    </div>
  )
}
