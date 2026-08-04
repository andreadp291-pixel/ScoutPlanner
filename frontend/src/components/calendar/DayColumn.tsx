import { useEffect, useRef, useState } from 'react'
import type { Activity } from '../../api/activities'
import { ActivityBlock } from './ActivityBlock'
import {
  DAY_END_MINUTES,
  DAY_START_MINUTES,
  PX_PER_MINUTE,
  clampMinutes,
  formatDayLabel,
  minutesSinceMidnight,
  nowMinutes,
  todayDateString,
} from './time'

interface DayColumnProps {
  date: string // 'YYYY-MM-DD'
  activities: Activity[]
  canEdit: boolean
  isDropTarget: boolean
  swapTargetId: number | null
  onRequestCreate: (date: string, startMinutes: number, endMinutes: number) => void
  onRequestEdit: (activity: Activity) => void
  onRequestMove: (activity: Activity, newDate: string, newStartMinutes: number) => void
  onRequestResize: (activity: Activity, newEndMinutes: number) => void
  onRequestSwap: (activity: Activity, targetActivityId: number) => void
  onDragHoverDate: (date: string | null) => void
  onSwapHoverId: (activityId: number | null) => void
}

const DEFAULT_DURATION_MINUTES = 30

export function DayColumn({
  date,
  activities,
  canEdit,
  isDropTarget,
  swapTargetId,
  onRequestCreate,
  onRequestEdit,
  onRequestMove,
  onRequestResize,
  onRequestSwap,
  onDragHoverDate,
  onSwapHoverId,
}: DayColumnProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [dragPreview, setDragPreview] = useState<{ start: number; end: number } | null>(null)
  const dragOrigin = useRef<number | null>(null)

  const isToday = date === todayDateString()
  const [now, setNow] = useState(() => nowMinutes())
  useEffect(() => {
    if (!isToday) return
    const id = setInterval(() => setNow(nowMinutes()), 60_000)
    return () => clearInterval(id)
  }, [isToday])

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

    if (current >= origin) {
      // trascinamento verso il basso: l'inizio resta fermo, la fine si ferma
      // in battuta contro l'attività successiva invece di sovrapporla
      let end = current
      for (const a of dayActivities) {
        const aStart = minutesSinceMidnight(a.start_at)
        if (aStart > origin && aStart < end) end = aStart
      }
      setDragPreview({ start: origin, end })
    } else {
      // trascinamento verso l'alto: la fine resta ferma, l'inizio si ferma
      // in battuta contro l'attività precedente
      let start = current
      for (const a of dayActivities) {
        const aEnd = minutesSinceMidnight(a.end_at)
        if (aEnd < origin && aEnd > start) start = aEnd
      }
      setDragPreview({ start, end: origin })
    }
  }

  function handlePointerUp() {
    if (dragOrigin.current === null || !dragPreview) return
    const { start } = dragPreview
    let { end } = dragPreview
    if (end - start < 5) {
      // click semplice, non drag: crea uno slot di durata standard, fermandosi
      // in battuta contro l'attività successiva se più vicina
      end = clampMinutes(start + DEFAULT_DURATION_MINUTES)
      for (const a of dayActivities) {
        const aStart = minutesSinceMidnight(a.start_at)
        if (aStart > start && aStart < end) end = aStart
      }
    }
    onRequestCreate(date, start, end)
    dragOrigin.current = null
    setDragPreview(null)
  }

  return (
    <div className="day-column" style={{ width: 220 }}>
      <div className={`day-column-header${isToday ? ' is-today' : ''}`}>{formatDayLabel(date)}</div>
      <div
        ref={trackRef}
        className={`day-column-track${isDropTarget ? ' drop-target' : ''}`}
        data-date={date}
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
            canEdit={canEdit}
            isSwapTarget={swapTargetId === activity.id}
            onClick={() => onRequestEdit(activity)}
            onMove={(newDate, newStart) => onRequestMove(activity, newDate, newStart)}
            onResize={(newEnd) => onRequestResize(activity, newEnd)}
            onSwap={(targetActivityId) => onRequestSwap(activity, targetActivityId)}
            onDragHoverDate={onDragHoverDate}
            onSwapHoverId={onSwapHoverId}
          />
        ))}
        {isToday && now >= DAY_START_MINUTES && now <= DAY_END_MINUTES && (
          <div className="now-line" style={{ top: (now - DAY_START_MINUTES) * PX_PER_MINUTE }} />
        )}
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
