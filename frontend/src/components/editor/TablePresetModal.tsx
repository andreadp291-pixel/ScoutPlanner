import { useState } from 'react'

export interface TablePresetGroup {
  id: number
  name: string
}

interface TablePresetModalProps {
  days: string[]
  groups: TablePresetGroup[]
  onInsert: (labels: string[], axis: 'row' | 'col') => void
  onClose: () => void
}

type Source = 'days' | 'groups'

export function TablePresetModal({ days, groups, onInsert, onClose }: TablePresetModalProps) {
  const [source, setSource] = useState<Source>(days.length > 0 ? 'days' : 'groups')
  const [axis, setAxis] = useState<'row' | 'col'>('row')
  const options = source === 'days' ? days : groups.map((g) => g.name)
  const [selected, setSelected] = useState<Set<string>>(new Set(options))

  function changeSource(next: Source) {
    setSource(next)
    setSelected(new Set(next === 'days' ? days : groups.map((g) => g.name)))
  }

  function toggle(label: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === options.length ? new Set() : new Set(options)))
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Inserisci preimpostati</h2>

        <label>Fonte</label>
        <div className="preset-radio-row">
          {days.length > 0 && (
            <label className="group-checkbox-item">
              <input type="radio" checked={source === 'days'} onChange={() => changeSource('days')} />
              Giorni del campo
            </label>
          )}
          {groups.length > 0 && (
            <label className="group-checkbox-item">
              <input type="radio" checked={source === 'groups'} onChange={() => changeSource('groups')} />
              Gruppi di lavoro
            </label>
          )}
        </div>

        <label>Inserisci come</label>
        <div className="preset-radio-row">
          <label className="group-checkbox-item">
            <input type="radio" checked={axis === 'row'} onChange={() => setAxis('row')} />
            Righe
          </label>
          <label className="group-checkbox-item">
            <input type="radio" checked={axis === 'col'} onChange={() => setAxis('col')} />
            Colonne
          </label>
        </div>

        {options.length > 0 ? (
          <>
            <label className="group-checkbox-item" style={{ margin: '10px 0 4px' }}>
              <input type="checkbox" checked={selected.size === options.length} onChange={toggleAll} />
              Seleziona tutti
            </label>
            <div className="group-checkbox-list">
              {options.map((label) => (
                <label key={label} className="group-checkbox-item">
                  <input type="checkbox" checked={selected.has(label)} onChange={() => toggle(label)} />
                  {label}
                </label>
              ))}
            </div>
          </>
        ) : (
          <p className="muted">Nessun elemento disponibile per questa fonte.</p>
        )}

        <div className="modal-actions">
          <div />
          <div className="modal-actions-primary">
            <button type="button" onClick={onClose}>
              Annulla
            </button>
            <button
              type="button"
              className="primary"
              disabled={selected.size === 0}
              onClick={() => onInsert(options.filter((o) => selected.has(o)), axis)}
            >
              Inserisci
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
