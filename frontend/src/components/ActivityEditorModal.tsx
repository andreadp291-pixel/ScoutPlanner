import { useState } from 'react'
import { CATEGORIES, colorForCategory } from './calendar/categories'
import type { Activity, ActivityInput } from '../api/activities'

interface ActivityEditorModalProps {
  date: string // 'YYYY-MM-DD' del giorno su cui si sta operando
  initial?: Activity // presente = modifica, assente = creazione
  defaultStartAt?: string // ISO datetime usato in creazione
  defaultEndAt?: string
  canDelete: boolean
  onSave: (input: ActivityInput) => void
  onDelete?: () => void
  onClose: () => void
}

export function ActivityEditorModal({
  initial,
  defaultStartAt,
  defaultEndAt,
  canDelete,
  onSave,
  onDelete,
  onClose,
}: ActivityEditorModalProps) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [location, setLocation] = useState(initial?.location ?? '')
  const [category, setCategory] = useState(initial?.category ?? CATEGORIES[0].value)
  const [startTime, setStartTime] = useState((initial?.start_at ?? defaultStartAt ?? '').slice(11, 16))
  const [endTime, setEndTime] = useState((initial?.end_at ?? defaultEndAt ?? '').slice(11, 16))

  const datePart = (initial?.start_at ?? defaultStartAt ?? '').slice(0, 10)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSave({
      title,
      description,
      location,
      category,
      color: colorForCategory(category),
      start_at: `${datePart}T${startTime}`,
      end_at: `${datePart}T${endTime}`,
    })
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{initial ? 'Modifica attività' : 'Nuova attività'}</h2>
        <form onSubmit={handleSubmit}>
          <label>
            Titolo
            <input required value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </label>
          <label>
            Descrizione
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <label>
            Luogo
            <input value={location} onChange={(e) => setLocation(e.target.value)} />
          </label>
          <label>
            Categoria
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <div className="time-range">
            <label>
              Inizio
              <input
                type="time"
                step={60}
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </label>
            <label>
              Fine
              <input
                type="time"
                step={60}
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </label>
          </div>
          <div className="modal-actions">
            {initial && canDelete && onDelete && (
              <button type="button" className="danger" onClick={onDelete}>
                Elimina
              </button>
            )}
            <button type="button" onClick={onClose}>
              Annulla
            </button>
            <button type="submit">Salva</button>
          </div>
        </form>
      </div>
    </div>
  )
}
