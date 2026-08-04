export const DAY_START_MINUTES = 0 // 00:00
export const DAY_END_MINUTES = 24 * 60 // 24:00
export const PX_PER_MINUTE = 1.5

export function minutesSinceMidnight(isoDatetime: string): number {
  const timePart = isoDatetime.split('T')[1] ?? '00:00'
  const [h, m] = timePart.split(':').map(Number)
  return h * 60 + m
}

export function clampMinutes(minutes: number): number {
  return Math.min(Math.max(minutes, DAY_START_MINUTES), DAY_END_MINUTES)
}

export function minutesToHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, '0')
  const m = (minutes % 60).toString().padStart(2, '0')
  return `${h}:${m}`
}

export function toIsoDatetime(date: string, minutes: number): string {
  return `${date}T${minutesToHHMM(clampMinutes(minutes))}`
}

function toDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function dateRange(start: string, end: string): string[] {
  const dates: string[] = []
  const cursor = new Date(start + 'T00:00:00')
  const last = new Date(end + 'T00:00:00')
  while (cursor <= last) {
    dates.push(toDateString(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return dates
}

const DAY_LABEL_FORMATTER = new Intl.DateTimeFormat('it-IT', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

export function formatDayLabel(date: string): string {
  const label = DAY_LABEL_FORMATTER.format(new Date(`${date}T00:00:00`))
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function todayDateString(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function nowMinutes(): number {
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes()
}

const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat('it-IT', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

export function formatShortDate(date: string): string {
  return SHORT_DATE_FORMATTER.format(new Date(`${date}T00:00:00`))
}

const CHIP_DATE_FORMATTER = new Intl.DateTimeFormat('it-IT', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
})

export function formatChipLabel(date: string): string {
  const label = CHIP_DATE_FORMATTER.format(new Date(`${date}T00:00:00`))
  return label.charAt(0).toUpperCase() + label.slice(1)
}
