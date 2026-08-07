import { useState } from 'react'
import type { PoiInput, PoiKind } from '../api/pois'
import { LocationPickerModal, type PickedLocation } from './editor/LocationPickerModal'
import { LocationIcon } from './icons/LocationIcon'

const KIND_LABELS: Record<PoiKind, string> = {
  hospital: 'Ospedale',
  pharmacy: 'Farmacia',
  fire_station: 'Vigili del fuoco',
  other: 'Altro',
}

interface PoiFormModalProps {
  onSave: (input: PoiInput) => void
  onClose: () => void
}

export function PoiFormModal({ onSave, onClose }: PoiFormModalProps) {
  const [kind, setKind] = useState<PoiKind>('hospital')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [position, setPosition] = useState<PickedLocation | null>(null)
  const [showLocationPicker, setShowLocationPicker] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    onSave({
      kind,
      name: name.trim(),
      phone: phone.trim(),
      address: address.trim(),
      notes: notes.trim(),
      lat: position?.lat ?? null,
      lon: position?.lon ?? null,
    })
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Aggiungi punto di interesse</h2>
        <form onSubmit={handleSubmit}>
          <label>
            Tipo
            <select value={kind} onChange={(e) => setKind(e.target.value as PoiKind)}>
              {Object.entries(KIND_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Nome
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label>
            Telefono
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Es. 0331 123456" />
          </label>
          <label>
            Indirizzo
            <input value={address} onChange={(e) => setAddress(e.target.value)} />
          </label>
          <label>
            Note
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          <button type="button" onClick={() => setShowLocationPicker(true)}>
            <LocationIcon size={14} /> {position ? 'Cambia posizione' : 'Scegli posizione sulla mappa'}
          </button>
          {position && <p className="muted" style={{ marginTop: 6 }}>{position.name}</p>}
          <div className="modal-actions">
            <div />
            <div className="modal-actions-primary">
              <button type="button" onClick={onClose}>
                Annulla
              </button>
              <button type="submit" className="primary" disabled={!name.trim()}>
                Salva
              </button>
            </div>
          </div>
        </form>
      </div>
      {showLocationPicker && (
        <LocationPickerModal
          onConfirm={(picked) => {
            setPosition(picked)
            setShowLocationPicker(false)
          }}
          onClose={() => setShowLocationPicker(false)}
        />
      )}
    </div>
  )
}
