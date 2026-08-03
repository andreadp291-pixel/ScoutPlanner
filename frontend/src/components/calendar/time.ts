export const DAY_START_MINUTES = 6 * 60 // 06:00
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
