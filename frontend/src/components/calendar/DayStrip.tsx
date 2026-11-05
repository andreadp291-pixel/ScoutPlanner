import { useEffect, useState } from 'react'
import { PX_PER_MINUTE, todayDateString } from './time'

const DAY_HEADER_PX = 48 // altezza dell'intestazione di ogni giorno
const FIRST_HOUR = 6

interface DayStripProps {
  days: string[]
  scrollRef: React.RefObject<HTMLDivElement | null>
}

const PHONE_QUERY = '(max-width: 700px)'

// Su telefono il calendario mostra un giorno alla volta, a tutta larghezza, con scatto sul giorno.
// Questa fascia (visibile solo su telefono) permette di saltare a un giorno e segue lo scorrimento.
export function DayStrip({ days, scrollRef }: DayStripProps) {
  const [active, setActive] = useState(0)
  const daysKey = days.join(',')

  function step(el: HTMLDivElement) {
    return el.querySelector<HTMLElement>('.day-column')?.getBoundingClientRect().width ?? 0
  }

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    function onScroll() {
      const w = step(el!)
      if (w) setActive(Math.max(0, Math.min(days.length - 1, Math.round(el!.scrollLeft / w))))
    }
    // all'apertura, sul giorno di oggi se il campo è in corso e verso le 6 del mattino
    // (il calendario parte da mezzanotte, ma su telefono le ore notturne sono quasi sempre vuote)
    if (window.matchMedia(PHONE_QUERY).matches) {
      const top = el.getBoundingClientRect().top + window.scrollY + DAY_HEADER_PX + FIRST_HOUR * 60 * PX_PER_MINUTE - 150
      if (window.scrollY < top) window.scrollTo({ top })
      const i = days.indexOf(todayDateString())
      if (i > 0) {
        el.scrollLeft = i * step(el)
        setActive(i)
      }
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
    // `days` è un array nuovo a ogni render del genitore: si riparte solo se cambiano le date
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollRef, daysKey])

  function jump(i: number) {
    const el = scrollRef.current
    if (el) el.scrollTo({ left: i * step(el), behavior: 'smooth' })
    setActive(i)
  }

  const today = todayDateString()
  return (
    <div className="day-strip" role="group" aria-label="Giorni del campo">
      {days.map((date, i) => {
        const d = new Date(`${date}T00:00:00`)
        const weekday = d.toLocaleDateString('it-IT', { weekday: 'short' }).replace('.', '')
        return (
          <button
            key={date}
            type="button"
            className={`day-chip${i === active ? ' active' : ''}${date === today ? ' is-today' : ''}`}
            aria-pressed={i === active}
            aria-label={d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
            onClick={() => jump(i)}
          >
            <small>{weekday}</small>
            <strong>{d.getDate()}</strong>
          </button>
        )
      })}
    </div>
  )
}
