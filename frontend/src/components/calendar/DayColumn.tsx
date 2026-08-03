import type { Activity } from '../../api/activities'
import { ActivityBlock } from './ActivityBlock'

const DAY_START_MINUTES = 6 * 60 // 06:00
const DAY_END_MINUTES = 24 * 60 // 24:00
const PX_PER_MINUTE = 1

interface DayColumnProps {
  date: string // 'YYYY-MM-DD'
  activities: Activity[]
}

export function DayColumn({ date, activities }: DayColumnProps) {
  const totalMinutes = DAY_END_MINUTES - DAY_START_MINUTES
  const dayActivities = activities.filter((a) => a.start_at.startsWith(date))

  return (
    <div className="day-column" style={{ width: 200 }}>
      <div className="day-column-header">{date}</div>
      <div
        className="day-column-track"
        style={{ position: 'relative', height: totalMinutes * PX_PER_MINUTE, border: '1px solid #ddd' }}
      >
        {dayActivities.map((activity) => (
          <ActivityBlock
            key={activity.id}
            activity={activity}
            dayStartMinutes={DAY_START_MINUTES}
            pxPerMinute={PX_PER_MINUTE}
          />
        ))}
      </div>
    </div>
  )
}
