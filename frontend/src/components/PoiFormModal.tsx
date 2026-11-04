import { useState } from 'react'
import type { Poi, PoiInput, PoiKind } from '../api/pois'
import { LocationPickerModal, type PickedLocation } from './editor/LocationPickerModal'
import { LocationIcon } from './icons/LocationIcon'

const KIND_LABELS: Record<PoiKind, string> = {
  hospital: 'Ospedale',
  pharmacy: 'Farmacia',
  fire_station: 'Vigili del fuoco',
  other: 'Altro',
}

interface PoiFormModalProps {
  initial?: Poi
  onSave: (input: PoiInput) => void
  onClose: () => void
}

export function PoiFormModal({ initial, onSave, onClose }: PoiFormModalProps) {
  const [kind, setKind] = useState<PoiKind>(initial?.kind ?? 'hospital')
  const [name, setName] = useState(initial?.name ?? '')
  const [phone, setPhone] = useState(initial?.phone ?? '')
  const [address, setAddress] = useState(initial?.address ?? '')
  const [hours, setHours] = useState(initial?.hours ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [position, setPosition] = useState<PickedLocation | null>(
    initial?.lat != null && initial?.lon != null
      ? { name: initial.address || initial.name, lat: initial.lat, lon: initial.lon }
      : null,
  )
  const [showLocationPicker, setShowLocationPicker] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    onSave({
      kind,
      name: name.trim(),
      phone: phone.trim(),
      address: address.trim(),
      hours: hours.trim(),
      notes: notes.trim(),
      lat: position?.lat ?? null,
      lon: position?.lon ?? null,
    })
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{initial ? 'Modifica punto di interesse' : 'Aggiungi punto di interesse'}</h2>
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
            Orari
            <input value={hours} onChange={(e) => setHours(e.target.value)} placeholder="Es. Lun-Ven 8-20, sab-dom chiuso" />
          </label>
          <label>
            Indirizzo
            <input value={address} onChange={(e) => setAddress(e.target.value)} />
          </label>
          <label>
            Note
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Altri contatti, riferimenti, indicazioni…" />
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
