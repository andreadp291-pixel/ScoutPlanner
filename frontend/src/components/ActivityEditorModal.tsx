import { useState } from 'react'
import type { Activity, ActivityInput } from '../api/activities'

const DEFAULT_COLOR = '#3b82f6'

interface ActivityEditorModalProps {
  date: string // 'YYYY-MM-DD' del giorno su cui si sta operando
  initial?: Activity // presente = modifica, assente = creazione
  defaultStartAt?: string // ISO datetime usato in creazione
  defaultEndAt?: string
  projectStartDate: string // 'YYYY-MM-DD', per limitare il picker di duplicazione
  projectEndDate: string
  canDelete: boolean
  onSave: (input: ActivityInput) => void
  onDelete?: () => void
  onDuplicate?: (startAt: string, endAt: string) => void
  onClose: () => void
}

export function ActivityEditorModal({
  initial,
  defaultStartAt,
  defaultEndAt,
  projectStartDate,
  projectEndDate,
  canDelete,
  onSave,
  onDelete,
  onDuplicate,
  onClose,
}: ActivityEditorModalProps) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [location, setLocation] = useState(initial?.location ?? '')
  const [color, setColor] = useState(initial?.color ?? DEFAULT_COLOR)
  const [startTime, setStartTime] = useState((initial?.start_at ?? defaultStartAt ?? '').slice(11, 16))
  const [endTime, setEndTime] = useState((initial?.end_at ?? defaultEndAt ?? '').slice(11, 16))

  const datePart = (initial?.start_at ?? defaultStartAt ?? '').slice(0, 10)

  const [showDuplicate, setShowDuplicate] = useState(false)
  const [dupDate, setDupDate] = useState(datePart)
  const [dupStart, setDupStart] = useState(startTime)
  const [dupEnd, setDupEnd] = useState(endTime)
  const [deleteArmed, setDeleteArmed] = useState(false)

  function handleDeleteClick() {
    if (!onDelete) return
    if (!deleteArmed) {
      setDeleteArmed(true)
      return
    }
    onDelete()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSave({
      title,
      description,
      location,
      category: 'attivita',
      color,
      start_at: `${datePart}T${startTime}`,
      end_at: `${datePart}T${endTime}`,
    })
  }

  function handleConfirmDuplicate() {
    if (!onDuplicate) return
    onDuplicate(`${dupDate}T${dupStart}`, `${dupDate}T${dupEnd}`)
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
            Colore
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="color-input"
            />
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

          {showDuplicate && (
            <div className="duplicate-panel">
              <p className="muted" style={{ marginBottom: 10 }}>
                Scegli giorno e orario per la copia
              </p>
              <label>
                Giorno
                <input
                  type="date"
                  required
                  min={projectStartDate}
                  max={projectEndDate}
                  value={dupDate}
                  onChange={(e) => setDupDate(e.target.value)}
                />
              </label>
              <div className="time-range">
                <label>
                  Inizio
                  <input
                    type="time"
                    step={60}
                    required
                    value={dupStart}
                    onChange={(e) => setDupStart(e.target.value)}
                  />
                </label>
                <label>
                  Fine
                  <input
                    type="time"
                    step={60}
                    required
                    value={dupEnd}
                    onChange={(e) => setDupEnd(e.target.value)}
                  />
                </label>
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setShowDuplicate(false)}>
                  Annulla
                </button>
                <button type="button" className="primary" onClick={handleConfirmDuplicate}>
                  Duplica qui
                </button>
              </div>
            </div>
          )}

          {!showDuplicate && (
            <div className="modal-actions">
              <div className="modal-actions-secondary">
                {initial && canDelete && onDelete && (
                  <button
                    type="button"
                    className="danger"
                    onClick={handleDeleteClick}
                    onBlur={() => setDeleteArmed(false)}
                  >
                    {deleteArmed ? 'Confermi?' : 'Elimina'}
                  </button>
                )}
                {initial && canDelete && onDuplicate && (
                  <button type="button" onClick={() => setShowDuplicate(true)}>
                    Duplica
                  </button>
                )}
              </div>
              <div className="modal-actions-primary">
                <button type="button" onClick={onClose}>
                  Annulla
                </button>
                <button type="submit">Salva</button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
