import { useRef, useState } from 'react'
import type { Activity } from '../../api/activities'
import { ActivityBlock } from './ActivityBlock'
import { DAY_END_MINUTES, DAY_START_MINUTES, PX_PER_MINUTE, clampMinutes, formatDayLabel } from './time'

interface DayColumnProps {
  date: string // 'YYYY-MM-DD'
  activities: Activity[]
  canEdit: boolean
  onRequestCreate: (date: string, startMinutes: number, endMinutes: number) => void
  onRequestEdit: (activity: Activity) => void
}

const DEFAULT_DURATION_MINUTES = 30

export function DayColumn({ date, activities, canEdit, onRequestCreate, onRequestEdit }: DayColumnProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [dragPreview, setDragPreview] = useState<{ start: number; end: number } | null>(null)
  const dragOrigin = useRef<number | null>(null)

  const totalMinutes = DAY_END_MINUTES - DAY_START_MINUTES
  const dayActivities = activities.filter((a) => a.start_at.startsWith(date))

  const hourLines: number[] = []
  for (let m = DAY_START_MINUTES; m <= DAY_END_MINUTES; m += 60) hourLines.push(m)

  function minutesFromPointer(clientY: number): number {
    const rect = trackRef.current!.getBoundingClientRect()
    const offsetY = clientY - rect.top
    return clampMinutes(DAY_START_MINUTES + Math.round(offsetY / PX_PER_MINUTE))
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (!canEdit || e.target !== trackRef.current) return
    const start = minutesFromPointer(e.clientY)
    dragOrigin.current = start
    setDragPreview({ start, end: start })
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (dragOrigin.current === null) return
    const current = minutesFromPointer(e.clientY)
    const origin = dragOrigin.current
    setDragPreview({ start: Math.min(origin, current), end: Math.max(origin, current) })
  }

  function handlePointerUp() {
    if (dragOrigin.current === null || !dragPreview) return
    const { start } = dragPreview
    let { end } = dragPreview
    if (end - start < 5) {
      // click semplice, non drag: crea uno slot di durata standard
      end = clampMinutes(start + DEFAULT_DURATION_MINUTES)
    }
    onRequestCreate(date, start, end)
    dragOrigin.current = null
    setDragPreview(null)
  }

  return (
    <div className="day-column" style={{ width: 220 }}>
      <div className="day-column-header">{formatDayLabel(date)}</div>
      <div
        ref={trackRef}
        className="day-column-track"
        style={{
          position: 'relative',
          height: totalMinutes * PX_PER_MINUTE,
          cursor: canEdit ? 'crosshair' : 'default',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {hourLines.map((m) => (
          <div
            key={m}
            className="hour-line"
            style={{ top: (m - DAY_START_MINUTES) * PX_PER_MINUTE }}
          />
        ))}
        {dayActivities.map((activity) => (
          <ActivityBlock
            key={activity.id}
            activity={activity}
            dayStartMinutes={DAY_START_MINUTES}
            pxPerMinute={PX_PER_MINUTE}
            onClick={() => onRequestEdit(activity)}
          />
        ))}
        {dragPreview && (
          <div
            style={{
              position: 'absolute',
              top: (dragPreview.start - DAY_START_MINUTES) * PX_PER_MINUTE,
              height: Math.max(1, (dragPreview.end - dragPreview.start) * PX_PER_MINUTE),
              left: 2,
              right: 2,
              background: 'rgba(59,130,246,0.35)',
              border: '1px dashed #3b82f6',
              borderRadius: 4,
              pointerEvents: 'none',
            }}
          />
        )}
      </div>
    </div>
  )
}
