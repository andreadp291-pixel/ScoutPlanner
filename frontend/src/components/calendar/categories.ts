export interface Category {
  value: string
  label: string
  color: string
}

export const CATEGORIES: Category[] = [
  { value: 'wake_up', label: 'Sveglia', color: '#f59e0b' },
  { value: 'meal', label: 'Pasto', color: '#22c55e' },
  { value: 'game', label: 'Gioco', color: '#3b82f6' },
  { value: 'workshop', label: 'Attività manuale', color: '#a855f7' },
  { value: 'hike', label: 'Escursione', color: '#0ea5e9' },
  { value: 'ceremony', label: 'Cerimonia', color: '#ef4444' },
  { value: 'free_time', label: 'Tempo libero', color: '#94a3b8' },
  { value: 'other', label: 'Altro', color: '#64748b' },
]

export function colorForCategory(category: string): string {
  return CATEGORIES.find((c) => c.value === category)?.color ?? '#64748b'
}
