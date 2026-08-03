import { useRef, useState } from 'react'
import type { Activity } from '../../api/activities'
import { DAY_END_MINUTES, DAY_START_MINUTES, minutesSinceMidnight } from './time'

interface ActivityBlockProps {
  activity: Activity
  dayStartMinutes: number
  pxPerMinute: number
  canEdit: boolean
  onClick: () => void
  onMove: (newStartMinutes: number) => void
  onResize: (newEndMinutes: number) => void
}

const DRAG_THRESHOLD_PX = 4
const MIN_DURATION_MINUTES = 5

export function ActivityBlock({
  activity,
  dayStartMinutes,
  pxPerMinute,
  canEdit,
  onClick,
  onMove,
  onResize,
}: ActivityBlockProps) {
  const startMinutes = minutesSinceMidnight(activity.start_at)
  const endMinutes = minutesSinceMidnight(activity.end_at)
  const duration = endMinutes - startMinutes

  const [dragOffset, setDragOffset] = useState<number | null>(null)
  const [resizeDelta, setResizeDelta] = useState<number | null>(null)
  const dragState = useRef<{ startY: number; moved: boolean } | null>(null)
  const resizeState = useRef<{ startY: number } | null>(null)

  const clampedOffset =
    dragOffset === null
      ? 0
      : Math.min(Math.max(dragOffset, DAY_START_MINUTES - startMinutes), DAY_END_MINUTES - duration - startMinutes)

  const top = (startMinutes - dayStartMinutes + clampedOffset) * pxPerMinute
  const height = Math.max(1, (duration + (resizeDelta ?? 0)) * pxPerMinute)

  function handleBodyPointerDown(e: React.PointerEvent) {
    e.stopPropagation()
    dragState.current = { startY: e.clientY, moved: false }
    if (canEdit) setDragOffset(0)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  function handleBodyPointerMove(e: React.PointerEvent) {
    if (!dragState.current) return
    const deltaY = e.clientY - dragState.current.startY
    if (Math.abs(deltaY) > DRAG_THRESHOLD_PX) dragState.current.moved = true
    if (canEdit) setDragOffset(Math.round(deltaY / pxPerMinute))
  }

  function handleBodyPointerUp() {
    if (!dragState.current) return
    const { moved } = dragState.current
    const finalOffset = dragOffset ?? 0
    dragState.current = null
    setDragOffset(null)
    if (canEdit && moved && finalOffset !== 0) {
      const clamped = Math.min(
        Math.max(finalOffset, DAY_START_MINUTES - startMinutes),
        DAY_END_MINUTES - duration - startMinutes,
      )
      if (clamped !== 0) onMove(startMinutes + clamped)
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
