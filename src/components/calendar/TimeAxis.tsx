import { DAY_END_MINUTES, DAY_START_MINUTES, PX_PER_MINUTE } from './time'

export function TimeAxis() {
  const hours: number[] = []
  for (let m = DAY_START_MINUTES; m <= DAY_END_MINUTES; m += 60) hours.push(m)

  return (
    <div className="time-axis-wrapper">
      <div className="day-column-header" aria-hidden="true">
        &nbsp;
      </div>
      <div className="time-axis" style={{ height: (DAY_END_MINUTES - DAY_START_MINUTES) * PX_PER_MINUTE }}>
        {hours.map((m) => (
          <div key={m} className="time-axis-label" style={{ top: (m - DAY_START_MINUTES) * PX_PER_MINUTE }}>
            {String(Math.floor(m / 60)).padStart(2, '0')}:00
          </div>
        ))}
      </div>
    </div>
  )
}
