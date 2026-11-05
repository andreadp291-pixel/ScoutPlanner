import { useRef } from 'react'
import type { Activity } from '../../api/activities'
import { DayColumn } from './DayColumn'
import { DayStrip } from './DayStrip'
import { TimeAxis } from './TimeAxis'

interface ReadOnlyCalendarProps {
  days: string[]
  activities: Activity[]
  onActivityClick: (activity: Activity) => void
}

const noop = () => {}

// Calendario in sola lettura: riusa DayColumn/TimeAxis esattamente come la
// modalità editing, ma con canEdit=false (niente drag/crea/ridimensiona) e
// l'unico gestore attivo (click su un'attività) ridiretto al popup rapido
// invece che al modal di modifica.
export function ReadOnlyCalendar({ days, activities, onActivityClick }: ReadOnlyCalendarProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  return (
    <>
    <DayStrip days={days} scrollRef={scrollRef} />
    <div className="calendar-scroll" ref={scrollRef} style={{ display: 'flex' }}>
      <TimeAxis />
      {days.map((date) => (
        <DayColumn
          key={date}
          date={date}
          activities={activities}
          canEdit={false}
          isDropTarget={false}
          swapTargetId={null}
          onRequestCreate={noop}
          onRequestEdit={onActivityClick}
          onRequestMove={noop}
          onRequestResize={noop}
          onRequestSwap={noop}
          onDragHoverDate={noop}
          onSwapHoverId={noop}
        />
      ))}
    </div>
    </>
  )
}
