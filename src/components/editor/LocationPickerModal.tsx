import type { LatLng } from 'leaflet'
import { useEffect, useState } from 'react'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import '../../lib/leafletIconFix'
import { PlusIcon } from '../icons/PlusIcon'

// Controllo zoom nostro, non quello di default di Leaflet: evita qualsiasi
// interferenza dal CSS che Leaflet applica ai suoi controlli integrati.
function ZoomControl() {
  const map = useMap()
  return (
    <div className="map-zoom-control">
      <button type="button" onClick={() => map.zoomIn()} aria-label="Aumenta zoom">
        <PlusIcon size={14} />
      </button>
      <button type="button" onClick={() => map.zoomOut()} aria-label="Riduci zoom">
        <span className="map-zoom-minus" />
      </button>
    </div>
  )
}

export interface PickedLocation {
  name: string
  lat: number
  lon: number
}

interface LocationPickerModalProps {
  onConfirm: (result: PickedLocation) => void
  onClose: () => void
}

interface SearchResult {
  display_name: string
  lat: string
  lon: string
}

const DEFAULT_CENTER: [number, number] = [45.4642, 9.19] // fallback: Milano

function ClickCatcher({ onPick }: { onPick: (latlng: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng)
    },
  })
  return null
}

function RecenterOnChange({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap()
  useEffect(() => {
    map.setView(center, zoom)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center[0], center[1], zoom])
  return null
}

// Il modal si apre con un'animazione CSS (scaleIn): Leaflet misura il contenitore
// al montaggio, prima che l'animazione finisca, e finisce con tile mal dimensionate/duplicate.
function MapSizeFix() {
  const map = useMap()
  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 250)
    return () => clearTimeout(timer)
  }, [map])
  return null
}

export function LocationPickerModal({ onConfirm, onClose }: LocationPickerModalProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<PickedLocation | null>(null)

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(query)}`,
      )
      const data = (await res.json()) as SearchResult[]
      setResults(data)
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
  }

  function pickResult(r: SearchResult) {
    setSelected({ name: r.display_name, lat: parseFloat(r.lat), lon: parseFloat(r.lon) })
    setResults([])
    setQuery(r.display_name)
  }

  function pickFromMap(latlng: LatLng) {
    setSelected({
      name: `Punto (${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)})`,
      lat: latlng.lat,
      lon: latlng.lng,
    })
    setResults([])
  }

  const center: [number, number] = selected ? [selected.lat, selected.lon] : DEFAULT_CENTER
  const zoom = selected ? 13 : 5

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal location-picker-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Scegli una posizione</h2>
        <form onSubmit={handleSearch} className="location-search-row">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca un luogo o indirizzo…"
          />
          <button type="submit" disabled={searching}>
            {searching ? 'Cerco...' : 'Cerca'}
          </button>
        </form>
        {results.length > 0 && (
          <ul className="location-results">
            {results.map((r) => (
              <li key={`${r.lat},${r.lon}`}>
                <button type="button" onClick={() => pickResult(r)}>
                  {r.display_name}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="location-map-wrap">
          <MapContainer center={center} zoom={zoom} style={{ height: 320, width: '100%' }} zoomControl={false}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <RecenterOnChange center={center} zoom={zoom} />
            <MapSizeFix />
            <ZoomControl />
            <ClickCatcher onPick={pickFromMap} />
            {selected && <Marker position={[selected.lat, selected.lon]} />}
          </MapContainer>
        </div>
        {selected && (
          <label style={{ marginTop: 10 }}>
            Etichetta da inserire nel testo
            <input
              value={selected.name}
              onChange={(e) => setSelected({ ...selected, name: e.target.value })}
            />
          </label>
        )}
        <p className="muted" style={{ marginTop: 8 }}>
          Clicca sulla mappa per scegliere un punto esatto, oppure cerca un nome sopra.
        </p>
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Annulla
          </button>
          <button
            type="button"
            className="primary"
            disabled={!selected}
            onClick={() => selected && onConfirm(selected)}
          >
            Inserisci posizione
          </button>
        </div>
      </div>
    </div>
  )
}
