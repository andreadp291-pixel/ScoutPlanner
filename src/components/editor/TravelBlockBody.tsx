import { useState } from 'react'
import { calculateTravelTime, hasTomTomKey } from '../../lib/tomtom'
import { LocationIcon } from '../icons/LocationIcon'
import type { Block } from './blocks'
import { LocationPickerModal, type PickedLocation } from './LocationPickerModal'

type TravelBlock = Extract<Block, { type: 'travel' }>

function formatDuration(min: number): string {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}

function formatComputedAt(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function TravelBlockBody({
  block,
  editable,
  onUpdate,
}: {
  block: TravelBlock
  editable: boolean
  onUpdate: (updater: (b: Block) => Block) => void
}) {
  const [pickerTarget, setPickerTarget] = useState<'origin' | 'dest' | null>(null)
  const [calculating, setCalculating] = useState(false)

  function setPicked(target: 'origin' | 'dest', picked: PickedLocation) {
    onUpdate((b) =>
      b.type === 'travel'
        ? target === 'origin'
          ? { ...b, originName: picked.name, originLat: picked.lat, originLon: picked.lon }
          : { ...b, destName: picked.name, destLat: picked.lat, destLon: picked.lon }
        : b,
    )
    setPickerTarget(null)
  }

  async function handleCalculate() {
    if (block.originLat == null || block.originLon == null || block.destLat == null || block.destLon == null) return
    setCalculating(true)
    try {
      const result = await calculateTravelTime(
        { lat: block.originLat, lon: block.originLon },
        { lat: block.destLat, lon: block.destLon },
      )
      onUpdate((b) =>
        b.type === 'travel'
          ? {
              ...b,
              durationMin: result.durationMin,
              distanceKm: result.distanceKm,
              trafficDelayMin: result.trafficDelayMin,
              computedAt: new Date().toISOString(),
            }
          : b,
      )
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Errore durante il calcolo')
    } finally {
      setCalculating(false)
    }
  }

  const hasBothPoints =
    block.originLat != null && block.originLon != null && block.destLat != null && block.destLon != null

  if (!editable) {
    if (!block.originName || !block.destName) return <p className="muted">(percorso non impostato)</p>
    return (
      <div className="block-travel-view">
        <p className="block-travel-route">
          <LocationIcon size={15} /> {block.originName} <span className="muted">→</span> {block.destName}
        </p>
        {block.durationMin != null ? (
          <div className="gpx-stats-strip">
            <div className="gpx-stat">
              <span className="gpx-stat-value">{formatDuration(block.durationMin)}</span>
              <span className="gpx-stat-label">Durata</span>
            </div>
            {block.distanceKm != null && (
              <div className="gpx-stat">
                <span className="gpx-stat-value">{block.distanceKm} km</span>
                <span className="gpx-stat-label">Distanza</span>
              </div>
            )}
            {!!block.trafficDelayMin && (
              <div className="gpx-stat">
                <span className="gpx-stat-value">+{block.trafficDelayMin} min</span>
                <span className="gpx-stat-label">Traffico</span>
              </div>
            )}
          </div>
        ) : (
          <p className="muted">Tempo non ancora calcolato.</p>
        )}
        {block.computedAt && <p className="muted">Calcolato il {formatComputedAt(block.computedAt)}</p>}
      </div>
    )
  }

  return (
    <div className="block-travel-edit">
      <div className="block-travel-points">
        <button type="button" onClick={() => setPickerTarget('origin')}>
          <LocationIcon size={14} /> {block.originName ? 'Cambia partenza' : 'Scegli partenza'}
        </button>
        <button type="button" onClick={() => setPickerTarget('dest')}>
          <LocationIcon size={14} /> {block.destName ? 'Cambia arrivo' : 'Scegli arrivo'}
        </button>
      </div>
      {(block.originName || block.destName) && (
        <p className="block-travel-route">
          {block.originName || <span className="muted">(partenza non scelta)</span>} <span className="muted">→</span>{' '}
          {block.destName || <span className="muted">(arrivo non scelto)</span>}
        </p>
      )}

      {!hasTomTomKey() && (
        <p className="muted">
          Chiave TomTom non configurata: il calcolo del tempo di viaggio non è disponibile (vedi
          docs/deployment.md).
        </p>
      )}

      {hasBothPoints && hasTomTomKey() && (
        <button type="button" onClick={handleCalculate} disabled={calculating}>
          {calculating ? 'Calcolo…' : block.durationMin != null ? 'Ricalcola tempo di viaggio' : 'Calcola tempo di viaggio'}
        </button>
      )}

      {block.durationMin != null && (
        <div className="gpx-stats-strip" style={{ marginTop: 10 }}>
          <div className="gpx-stat">
            <span className="gpx-stat-value">{formatDuration(block.durationMin)}</span>
            <span className="gpx-stat-label">Durata</span>
          </div>
          {block.distanceKm != null && (
            <div className="gpx-stat">
              <span className="gpx-stat-value">{block.distanceKm} km</span>
              <span className="gpx-stat-label">Distanza</span>
            </div>
          )}
          {!!block.trafficDelayMin && (
            <div className="gpx-stat">
              <span className="gpx-stat-value">+{block.trafficDelayMin} min</span>
              <span className="gpx-stat-label">Traffico</span>
            </div>
          )}
        </div>
      )}
      {block.computedAt && <p className="muted">Calcolato il {formatComputedAt(block.computedAt)}</p>}

      {pickerTarget && (
        <LocationPickerModal
          onConfirm={(picked) => setPicked(pickerTarget, picked)}
          onClose={() => setPickerTarget(null)}
        />
      )}
    </div>
  )
}
