import { useRef, useState } from 'react'
import type { Activity } from '../../api/activities'
import { DAY_END_MINUTES, DAY_START_MINUTES, minutesSinceMidnight } from './time'

interface ActivityBlockProps {
  activity: Activity
  dayStartMinutes: number
  pxPerMinute: number
  canEdit: boolean
  onClick: () => void
  onMove: (newDate: string, newStartMinutes: number) => void
  onResize: (newEndMinutes: number) => void
  onDragHoverDate: (date: string | null) => void
}

const DRAG_THRESHOLD_PX = 4
const MIN_DURATION_MINUTES = 5

interface DragPreview {
  date: string
  start: number
}

export function ActivityBlock({
  activity,
  dayStartMinutes,
  pxPerMinute,
  canEdit,
  onClick,
  onMove,
  onResize,
  onDragHoverDate,
}: ActivityBlockProps) {
  const ownDate = activity.start_at.slice(0, 10)
  const startMinutes = minutesSinceMidnight(activity.start_at)
  const endMinutes = minutesSinceMidnight(activity.end_at)
  const duration = endMinutes - startMinutes

  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null)
  const [resizeDelta, setResizeDelta] = useState<number | null>(null)
  const dragState = useRef<{ grabOffsetMinutes: number; startX: number; startY: number; moved: boolean } | null>(
    null,
  )
  const resizeState = useRef<{ startY: number } | null>(null)

  const sameColumn = dragPreview === null || dragPreview.date === ownDate
  const top = sameColumn && dragPreview ? (dragPreview.start - dayStartMinutes) * pxPerMinute : (startMinutes - dayStartMinutes) * pxPerMinute
  const height = Math.max(1, (duration + (resizeDelta ?? 0)) * pxPerMinute)
  const isLiftedElsewhere = dragPreview !== null && !sameColumn

  function findTrack(clientX: number, clientY: number): { el: HTMLElement; date: string } | null {
    const el = document.elementFromPoint(clientX, clientY)
    const track = el?.closest<HTMLElement>('.day-column-track')
    if (!track || !track.dataset.date) return null
    return { el: track, date: track.dataset.date }
  }

  function handleBodyPointerDown(e: React.PointerEvent) {
    e.stopPropagation()
    const found = findTrack(e.clientX, e.clientY)
    const trackRect = found?.el.getBoundingClientRect()
    const grabOffsetMinutes = trackRect
      ? Math.round((e.clientY - trackRect.top) / pxPerMinute) - startMinutes
      : 0
    dragState.current = { grabOffsetMinutes, startX: e.clientX, startY: e.clientY, moved: false }
    if (canEdit) setDragPreview({ date: ownDate, start: startMinutes })
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  function handleBodyPointerMove(e: React.PointerEvent) {
    if (!dragState.current) return
    const dist = Math.hypot(e.clientX - dragState.current.startX, e.clientY - dragState.current.startY)
    if (dist > DRAG_THRESHOLD_PX) dragState.current.moved = true
    if (!canEdit) return

    const found = findTrack(e.clientX, e.clientY)
    if (!found) return
    const rect = found.el.getBoundingClientRect()
    const minutesUnderPointer = DAY_START_MINUTES + (e.clientY - rect.top) / pxPerMinute
    const rawStart = Math.round(minutesUnderPointer - dragState.current.grabOffsetMinutes)
    const newStart = Math.min(Math.max(rawStart, DAY_START_MINUTES), DAY_END_MINUTES - duration)
    setDragPreview({ date: found.date, start: newStart })
    onDragHoverDate(found.date)
  }

  function handleBodyPointerUp() {
    if (!dragState.current) return
    const { moved } = dragState.current
    const preview = dragPreview
    dragState.current = null
    setDragPreview(null)
    onDragHoverDate(null)
    if (canEdit && moved && preview && (preview.date !== ownDate || preview.start !== startMinutes)) {
      onMove(preview.date, preview.start)
    } else if (!moved) {
      onClick()
    }
  }

  function handleResizePointerDown(e: React.PointerEvent) {
    e.stopPropagation()
    if (!canEdit) return
    resizeState.current = { startY: e.clientY }
    setResizeDelta(0)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  function handleResizePointerMove(e: React.PointerEvent) {
    if (!resizeState.current) return
    const deltaY = e.clientY - resizeState.current.startY
    const deltaMinutes = Math.round(deltaY / pxPerMinute)
    const maxDelta = DAY_END_MINUTES - endMinutes
    setResizeDelta(Math.min(Math.max(deltaMinutes, MIN_DURATION_MINUTES - duration), maxDelta))
  }

  function handleResizePointerUp() {
    if (!resizeState.current) return
    const finalDelta = resizeDelta ?? 0
    resizeState.current = null
    setResizeDelta(null)
    if (finalDelta !== 0) onResize(endMinutes + finalDelta)
  }

  return (
    <div
      className="activity-block"
      onPointerDown={handleBodyPointerDown}
      onPointerMove={handleBodyPointerMove}
      onPointerUp={handleBodyPointerUp}
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
        cursor: canEdit ? 'grab' : 'pointer',
        opacity: isLiftedElsewhere ? 0.35 : 1,
      }}
      title={`${activity.title} (${activity.start_at.slice(11)}–${activity.end_at.slice(11)})`}
    >
      {activity.title}
      {canEdit && (
        <div
          className="activity-resize-handle"
          onPointerDown={handleResizePointerDown}
          onPointerMove={handleResizePointerMove}
          onPointerUp={handleResizePointerUp}
        />
      )}
    </div>
  )
}
