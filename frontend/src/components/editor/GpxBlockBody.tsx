import L from 'leaflet'
import { useEffect, useMemo, useRef, useState } from 'react'
import { uploadFile } from '../../api/uploads'
import { indexAtKm } from '../../lib/elevation'
import { parseGpx, type GpxStats } from '../../lib/gpx'
import { isHttpUrl } from '../../lib/url'
import { CompassIcon } from '../icons/CompassIcon'
import type { Block } from './blocks'
import { ElevationChart } from './ElevationChart'

type LatLon = [number, number]


// Punto più vicino a un dato km in un array ordinato per km crescente
// (usato sia per il profilo quota che per il tracciato lat/lon).
function nearestByKm<T extends { km: number }>(arr: T[], km: number): T {
  return arr[indexAtKm(arr, km)]
}

function useGpxStats(url: string) {
  const [stats, setStats] = useState<GpxStats | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setStats(null)
    setError(null)
    // L'url arriva dal contenuto salvato, che un editor può scrivere a mano: va controllato.
    if (!isHttpUrl(url)) {
      setError('Allegato non valido')
      return
    }
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(res.statusText)
        return res.text()
      })
      .then((text) => {
        if (!cancelled) setStats(parseGpx(text))
      })
      .catch(() => {
        if (!cancelled) setError('Impossibile leggere il file GPX')
      })
    return () => {
      cancelled = true
    }
  }, [url])

  return { stats, error }
}

function GpxStatsStrip({ stats }: { stats: GpxStats }) {
  return (
    <div className="gpx-stats-strip">
      <div className="gpx-stat">
        <span className="gpx-stat-value">{stats.distanceKm.toFixed(1)} km</span>
        <span className="gpx-stat-label">Distanza</span>
      </div>
      <div className="gpx-stat">
        <span className="gpx-stat-value">+{Math.round(stats.elevationGainM)} m</span>
        <span className="gpx-stat-label">Salita</span>
      </div>
      <div className="gpx-stat">
        <span className="gpx-stat-value">-{Math.round(stats.elevationLossM)} m</span>
        <span className="gpx-stat-label">Discesa</span>
      </div>
      {stats.maxAltitudeM !== null && (
        <div className="gpx-stat">
          <span className="gpx-stat-value">{Math.round(stats.maxAltitudeM)} m</span>
          <span className="gpx-stat-label">Quota max</span>
        </div>
      )}
    </div>
  )
}

// Mappa Leaflet "vanilla" (L.map diretto, non react-leaflet): stesso identico
// pattern già in uso e collaudato altrove nel progetto. La regola CSS
// `.leaflet-container { z-index: 0 }` isola già i pannelli interni di Leaflet
// (che di norma hanno z-index 400-1000) nel proprio stacking context, quindi
// non finiscono mai sopra ai modal/menu della pagina.
function GpxMap({ segments, cursor }: { segments: LatLon[][]; cursor: LatLon | null }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const cursorMarkerRef = useRef<L.CircleMarker | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const map = L.map(containerRef.current)

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map)

    // flat() e non push(...segment): con centinaia di migliaia di punti lo spread supera il limite di argomenti
    const allLatLngs: LatLon[] = segments.flat()
    segments.forEach((segment) => L.polyline(segment, { color: '#c0392b', weight: 3 }).addTo(map))

    if (allLatLngs.length > 0) {
      L.circleMarker(allLatLngs[0], {
        radius: 5, color: '#fff', weight: 2, fillColor: '#2e8b57', fillOpacity: 1,
      }).addTo(map)
      L.circleMarker(allLatLngs[allLatLngs.length - 1], {
        radius: 5, color: '#fff', weight: 2, fillColor: '#c0392b', fillOpacity: 1,
      }).addTo(map)
      map.fitBounds(L.latLngBounds(allLatLngs), { padding: [30, 30] })
    }

    // Marcatore "sei qui", sincronizzato con lo slider del grafico quota:
    // creato una volta sola e poi solo spostato (setLatLng), mai ricreato,
    // altrimenti la mappa "salterebbe" ad ogni tick dello slider.
    cursorMarkerRef.current = L.circleMarker(cursor ?? allLatLngs[0] ?? [0, 0], {
      radius: 7,
      color: '#fff',
      weight: 2,
      fillColor: '#2563eb',
      fillOpacity: 1,
    }).addTo(map)

    return () => {
      map.remove()
      cursorMarkerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (cursor) cursorMarkerRef.current?.setLatLng(cursor)
  }, [cursor])

  return (
    <div className="gpx-map-wrap">
      <div ref={containerRef} style={{ height: 360, width: '100%' }} />
    </div>
  )
}

function GpxTrackView({ url, filename }: { url: string; filename: string }) {
  const { stats, error } = useGpxStats(url)
  const [scrubKm, setScrubKm] = useState(0)

  // una volta per traccia, non a ogni movimento del mirino (con 100k+ punti faceva scattare tutto)
  const segments = useMemo(
    () => stats?.segments.map((seg) => seg.map((p): LatLon => [p.lat, p.lon])) ?? [],
    [stats],
  )
  const hasPoints = segments.some((seg) => seg.length > 0)

  const cursor: LatLon | null = stats?.track.length
    ? (() => {
        const p = nearestByKm(stats.track, scrubKm)
        return [p.lat, p.lon]
      })()
    : null

  return (
    <div className="gpx-card">
      <div className="gpx-card-header">
        {isHttpUrl(url) ? (
          <a href={url} download={filename} className="gpx-attachment-link">
            <CompassIcon size={16} /> {filename}
          </a>
        ) : (
          <span className="gpx-attachment-link">
            <CompassIcon size={16} /> {filename}
          </span>
        )}
      </div>
      {error && <p className="muted">{error}</p>}
      {!error && !stats && <p className="muted">Caricamento traccia…</p>}
      {stats && hasPoints && (
        <>
          <GpxMap segments={segments} cursor={cursor} />
          <GpxStatsStrip stats={stats} />
          <ElevationChart profile={stats.profile} scrubKm={scrubKm} onScrubKmChange={setScrubKm} />
        </>
      )}
    </div>
  )
}

export function GpxBlockBody({
  block,
  editable,
  projectId,
  onUpdate,
}: {
  block: Extract<Block, { type: 'gpx' }>
  editable: boolean
  projectId: number
  onUpdate: (updater: (b: Block) => Block) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    try {
      const result = await uploadFile(projectId, file)
      onUpdate((b) => (b.type === 'gpx' ? { ...b, url: result.url, filename: result.filename } : b))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Errore durante il caricamento del file GPX')
    } finally {
      setUploading(false)
    }
  }

  if (!editable) {
    return block.url ? (
      <GpxTrackView url={block.url} filename={block.filename} />
    ) : (
      <p className="muted">(nessuna traccia)</p>
    )
  }

  return (
    <div className="block-gpx-edit">
      {block.url && <GpxTrackView url={block.url} filename={block.filename} />}
      <input ref={inputRef} type="file" accept=".gpx" onChange={handleFile} style={{ display: 'none' }} />
      <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}>
        <CompassIcon size={14} /> {uploading ? 'Caricamento…' : block.url ? 'Sostituisci traccia' : 'Carica file GPX'}
      </button>{' '}
      <a href="https://gpx.studio/app" target="_blank" rel="noopener noreferrer" className="btn">
        Disegna su gpx.studio ↗
      </a>
      <p className="muted" style={{ marginTop: 6 }}>
        Su gpx.studio disegna il percorso, poi «Esporta» il file GPX e caricalo qui.
      </p>
    </div>
  )
}
