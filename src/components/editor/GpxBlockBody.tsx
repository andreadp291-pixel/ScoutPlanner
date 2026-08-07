import L from 'leaflet'
import { useEffect, useRef, useState } from 'react'
import { uploadFile } from '../../api/uploads'
import { downsample, parseGpx, type GpxStats } from '../../lib/gpx'
import { CompassIcon } from '../icons/CompassIcon'
import type { Block } from './blocks'

type LatLon = [number, number]
type Bounds = [LatLon, LatLon]

function ElevationProfile({ profile }: { profile: GpxStats['profile'] }) {
  if (profile.length < 2) return null
  const width = 600
  const height = 90
  const maxKm = profile[profile.length - 1].km || 1
  const eles = profile.map((p) => p.ele)
  const minEle = Math.min(...eles)
  const maxEle = Math.max(...eles)
  const eleRange = Math.max(maxEle - minEle, 1)

  const linePoints = profile
    .map((p) => {
      const x = (p.km / maxKm) * width
      const y = height - ((p.ele - minEle) / eleRange) * (height - 10) - 5
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  const areaPoints = `0,${height} ${linePoints} ${width},${height}`

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="gpx-elevation-chart" preserveAspectRatio="none">
      <polygon points={areaPoints} className="gpx-elevation-area" />
      <polyline points={linePoints} className="gpx-elevation-line" />
    </svg>
  )
}

function computeBounds(points: LatLon[]): Bounds {
  let minLat = points[0][0]
  let maxLat = points[0][0]
  let minLon = points[0][1]
  let maxLon = points[0][1]
  for (const [lat, lon] of points) {
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
    if (lon < minLon) minLon = lon
    if (lon > maxLon) maxLon = lon
  }
  return [
    [minLat, minLon],
    [maxLat, maxLon],
  ]
}

function useGpxStats(url: string) {
  const [stats, setStats] = useState<GpxStats | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setStats(null)
    setError(null)
    fetch(url)
      .then((res) => res.text())
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
function GpxMap({ segments }: { segments: LatLon[][] }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const map = L.map(containerRef.current)

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map)

    const allLatLngs: LatLon[] = []
    segments.forEach((segment) => {
      allLatLngs.push(...segment)
      L.polyline(segment, { color: '#c0392b', weight: 3 }).addTo(map)
    })

    if (allLatLngs.length > 0) {
      L.circleMarker(allLatLngs[0], {
        radius: 5, color: '#fff', weight: 2, fillColor: '#2e8b57', fillOpacity: 1,
      }).addTo(map)
      L.circleMarker(allLatLngs[allLatLngs.length - 1], {
        radius: 5, color: '#fff', weight: 2, fillColor: '#c0392b', fillOpacity: 1,
      }).addTo(map)
      map.fitBounds(L.latLngBounds(allLatLngs), { padding: [30, 30] })
    }

    return () => {
      map.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="gpx-map-wrap">
      <div ref={containerRef} style={{ height: 360, width: '100%' }} />
    </div>
  )
}

function GpxTrackView({ url, filename }: { url: string; filename: string }) {
  const { stats, error } = useGpxStats(url)

  const segments: LatLon[][] =
    stats?.segments.map((seg) => downsample(seg, 1500).map((p): LatLon => [p.lat, p.lon])) ?? []
  const allPoints = segments.flat()
  const bounds = allPoints.length > 0 ? computeBounds(allPoints) : null

  return (
    <div className="gpx-card">
      <div className="gpx-card-header">
        <a href={url} download={filename} className="gpx-attachment-link">
          <CompassIcon size={16} /> {filename}
        </a>
      </div>
      {error && <p className="muted">{error}</p>}
      {!error && !stats && <p className="muted">Caricamento traccia…</p>}
      {stats && bounds && (
        <>
          <GpxMap segments={segments} />
          <GpxStatsStrip stats={stats} />
          <ElevationProfile profile={stats.profile} />
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
      </button>
    </div>
  )
}
