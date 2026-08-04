import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Activity, ActivityInput } from '../api/activities'
import type { Group } from '../api/groups'
import { FileTextIcon } from './icons/FileTextIcon'
import { dateRange, formatChipLabel } from './calendar/time'

const DEFAULT_COLOR = '#3b82f6'

export interface DuplicateEntry {
  startAt: string
  endAt: string
}

interface ActivityEditorModalProps {
  date: string // 'YYYY-MM-DD' del giorno su cui si sta operando
  projectId: number
  initial?: Activity // presente = modifica, assente = creazione
  defaultStartAt?: string // ISO datetime usato in creazione
  defaultEndAt?: string
  projectStartDate: string // 'YYYY-MM-DD', per limitare la selezione dei giorni di duplicazione
  projectEndDate: string
  canDelete: boolean
  groups: Group[]
  onSave: (input: ActivityInput) => void
  onDelete?: () => void
  onDuplicate?: (entries: DuplicateEntry[]) => void
  onClose: () => void
}

export function ActivityEditorModal({
  projectId,
  initial,
  defaultStartAt,
  defaultEndAt,
  projectStartDate,
  projectEndDate,
  canDelete,
  groups,
  onSave,
  onDelete,
  onDuplicate,
  onClose,
}: ActivityEditorModalProps) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [color, setColor] = useState(initial?.color ?? DEFAULT_COLOR)
  const [startTime, setStartTime] = useState((initial?.start_at ?? defaultStartAt ?? '').slice(11, 16))
  const [endTime, setEndTime] = useState((initial?.end_at ?? defaultEndAt ?? '').slice(11, 16))
  const [groupIds, setGroupIds] = useState<Set<number>>(() => new Set(initial?.group_ids ?? []))

  const datePart = (initial?.start_at ?? defaultStartAt ?? '').slice(0, 10)

  const [showDuplicate, setShowDuplicate] = useState(false)
  const [dupDates, setDupDates] = useState<Set<string>>(() => new Set())
  const [dupStart, setDupStart] = useState(startTime)
  const [dupEnd, setDupEnd] = useState(endTime)
  const [deleteArmed, setDeleteArmed] = useState(false)

  const projectDays = dateRange(projectStartDate, projectEndDate)

  function toggleDupDate(d: string) {
    setDupDates((prev) => {
      const next = new Set(prev)
      if (next.has(d)) next.delete(d)
      else next.add(d)
      return next
    })
  }

  function handleDeleteClick() {
    if (!onDelete) return
    if (!deleteArmed) {
      setDeleteArmed(true)
      return
    }
    onDelete()
  }

  function toggleGroup(id: number) {
    setGroupIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // Niente description/location/materials qui: sono gestite nella pagina
    // "Descrivi attività" e non vanno sovrascritte da questo form ridotto.
    onSave({
      title,
      category: 'attivita',
      color,
      group_ids: [...groupIds],
      start_at: `${datePart}T${startTime}`,
      end_at: `${datePart}T${endTime}`,
    })
  }

  function handleConfirmDuplicate() {
    if (!onDuplicate || dupDates.size === 0) return
    onDuplicate(
      [...dupDates].map((d) => ({ startAt: `${d}T${dupStart}`, endAt: `${d}T${dupEnd}` })),
    )
  }

  function openDuplicatePanel() {
    setDupDates(new Set(datePart ? [datePart] : []))
    setShowDuplicate(true)
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

          {!showDuplicate && groups.length > 0 && (
            <>
              <label>Gruppi</label>
              <div className="group-checkbox-list">
                {groups.map((g) => (
                  <label key={g.id} className="group-checkbox-item">
                    <input
                      type="checkbox"
                      checked={groupIds.has(g.id)}
                      onChange={() => toggleGroup(g.id)}
                    />
                    {g.name}
                  </label>
                ))}
              </div>
            </>
          )}

          {initial && !showDuplicate && (
            <Link
              to={`/projects/${projectId}/activities/${initial.id}/description`}
              className="btn describe-activity-btn"
            >
              <FileTextIcon />
              Descrivi attività
            </Link>
          )}

          {showDuplicate && (
            <div className="duplicate-panel">
              <p className="muted" style={{ marginBottom: 10 }}>
                Scegli uno o più giorni e l'orario per le copie
              </p>
              <div className="day-chip-row">
                {projectDays.map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={`day-chip${dupDates.has(d) ? ' selected' : ''}`}
                    onClick={() => toggleDupDate(d)}
                  >
                    {formatChipLabel(d)}
                  </button>
                ))}
              </div>
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
                <button
                  type="button"
                  className="primary"
                  onClick={handleConfirmDuplicate}
                  disabled={dupDates.size === 0}
                >
                  {dupDates.size > 1 ? `Duplica su ${dupDates.size} giorni` : 'Duplica qui'}
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
                  <button type="button" onClick={openDuplicatePanel}>
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
