import { useState } from 'react'
import type { PoiInput, PoiKind } from '../api/pois'
import { haversineMeters } from '../lib/geo'

const SEARCH_RADIUS_M = 15000

const AMENITY_TO_KIND: Record<string, PoiKind> = {
  hospital: 'hospital',
  pharmacy: 'pharmacy',
  fire_station: 'fire_station',
}

const KIND_LABELS: Record<PoiKind, string> = {
  hospital: 'Ospedale',
  pharmacy: 'Farmacia',
  fire_station: 'Vigili del fuoco',
  other: 'Altro',
}

interface OverpassElement {
  lat: number
  lon: number
  tags?: Record<string, string>
}

interface Candidate {
  key: string
  kind: PoiKind
  name: string
  phone: string
  address: string
  lat: number
  lon: number
  distanceM: number
}

function buildAddress(tags: Record<string, string>): string {
  const street = tags['addr:street']
  const num = tags['addr:housenumber']
  const city = tags['addr:city']
  return [street && num ? `${street} ${num}` : street, city].filter(Boolean).join(', ')
}

async function searchOverpass(lat: number, lon: number): Promise<Candidate[]> {
  const query = `[out:json][timeout:25];(
    node["amenity"="hospital"](around:${SEARCH_RADIUS_M},${lat},${lon});
    node["amenity"="pharmacy"](around:${SEARCH_RADIUS_M},${lat},${lon});
    node["amenity"="fire_station"](around:${SEARCH_RADIUS_M},${lat},${lon});
  );out body;`

  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: `data=${encodeURIComponent(query)}`,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
  if (!res.ok) throw new Error('Ricerca non riuscita')
  const data = (await res.json()) as { elements: OverpassElement[] }

  const seen = new Set<string>()
  const candidates: Candidate[] = []
  for (const el of data.elements) {
    const tags = el.tags ?? {}
    const kind = AMENITY_TO_KIND[tags.amenity ?? '']
    if (!kind || typeof el.lat !== 'number' || typeof el.lon !== 'number') continue
    const name = tags.name || `${KIND_LABELS[kind]} senza nome`
    const key = `${kind}:${name}:${el.lat.toFixed(4)}:${el.lon.toFixed(4)}`
    if (seen.has(key)) continue
    seen.add(key)
    candidates.push({
      key,
      kind,
      name,
      phone: tags.phone || tags['contact:phone'] || '',
      address: buildAddress(tags),
      lat: el.lat,
      lon: el.lon,
      distanceM: haversineMeters({ lat, lon }, { lat: el.lat, lon: el.lon }),
    })
  }
  candidates.sort((a, b) => a.distanceM - b.distanceM)
  return candidates
}

interface PoiSearchModalProps {
  campLocation: { lat: number; lon: number }
  onImport: (pois: PoiInput[]) => void
  onClose: () => void
}

export function PoiSearchModal({ campLocation, onImport, onClose }: PoiSearchModalProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())

  async function runSearch() {
    setStatus('loading')
    try {
      const found = await searchOverpass(campLocation.lat, campLocation.lon)
      setCandidates(found)
      setSelected(new Set(found.map((c) => c.key)))
      setStatus('done')
    } catch {
      setStatus('error')
    }
  }

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === candidates.length ? new Set() : new Set(candidates.map((c) => c.key))))
  }

  function handleImport() {
    const picked = candidates.filter((c) => selected.has(c.key))
    onImport(
      picked.map((c) => ({
        kind: c.kind,
        name: c.name,
        phone: c.phone,
        address: c.address,
        lat: c.lat,
        lon: c.lon,
      })),
    )
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal poi-search-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Cerca vicino al campo</h2>
        <p className="muted" style={{ marginBottom: 12 }}>
          Cerca ospedali, farmacie e vigili del fuoco entro {SEARCH_RADIUS_M / 1000} km dalla posizione del campo
          (dati OpenStreetMap). Rivedi i risultati prima di aggiungerli.
        </p>

        {status === 'idle' && (
          <button type="button" className="primary" onClick={runSearch}>
            Cerca
          </button>
        )}
        {status === 'loading' && <p className="muted">Ricerca in corso…</p>}
        {status === 'error' && (
          <>
            <p className="muted">Ricerca non riuscita. Riprova.</p>
            <button type="button" onClick={runSearch}>
              Riprova
            </button>
          </>
        )}
        {status === 'done' && candidates.length === 0 && (
          <p className="muted">Nessun risultato trovato entro {SEARCH_RADIUS_M / 1000} km.</p>
        )}
        {status === 'done' && candidates.length > 0 && (
          <>
            <label className="group-checkbox-item" style={{ marginBottom: 8 }}>
              <input
                type="checkbox"
                checked={selected.size === candidates.length}
                onChange={toggleAll}
              />
              Seleziona tutti ({candidates.length})
            </label>
            <div className="group-checkbox-list poi-search-results">
              {candidates.map((c) => (
                <label key={c.key} className="group-checkbox-item">
                  <input type="checkbox" checked={selected.has(c.key)} onChange={() => toggle(c.key)} />
                  <span>
                    <strong>{c.name}</strong> · {KIND_LABELS[c.kind]} · {(c.distanceM / 1000).toFixed(1)} km
                    {c.address && <> · {c.address}</>}
                  </span>
                </label>
              ))}
            </div>
          </>
        )}

        <div className="modal-actions">
          <div />
          <div className="modal-actions-primary">
            <button type="button" onClick={onClose}>
              Annulla
            </button>
            {status === 'done' && candidates.length > 0 && (
              <button type="button" className="primary" disabled={selected.size === 0} onClick={handleImport}>
                Aggiungi selezionati ({selected.size})
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
