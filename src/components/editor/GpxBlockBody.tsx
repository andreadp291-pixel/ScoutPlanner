import L from 'leaflet'
import { useEffect, useMemo, useRef, useState } from 'react'
import { uploadFile } from '../../api/uploads'
import { parseGpx, type GpxStats } from '../../lib/gpx'
import { CompassIcon } from '../icons/CompassIcon'
import type { Block } from './blocks'

type LatLon = [number, number]
type Bounds = [LatLon, LatLon]

const CHART_W = 600
const CHART_H = 170
const MARGIN = { top: 10, right: 10, bottom: 20, left: 38 }
const INNER_W = CHART_W - MARGIN.left - MARGIN.right
const INNER_H = CHART_H - MARGIN.top - MARGIN.bottom

// Punto del profilo più vicino a un dato km (il profilo è già ordinato per km crescente).
function nearestProfilePoint(profile: GpxStats['profile'], km: number) {
  let lo = 0
  let hi = profile.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (profile[mid].km < km) lo = mid + 1
    else hi = mid
  }
  return profile[lo]
}

function ElevationChart({ profile }: { profile: GpxStats['profile'] }) {
  const [scrubKm, setScrubKm] = useState(0)

  const maxKm = profile.length ? profile[profile.length - 1].km || 1 : 1
  const eles = profile.map((p) => p.ele)
  const minEle = profile.length ? Math.min(...eles) : 0
  const maxEle = profile.length ? Math.max(...eles) : 0
  const eleRange = Math.max(maxEle - minEle, 1)

  // Dislivello positivo cumulato punto per punto: lookup istantaneo mentre si scorre.
  const cumGain = useMemo(() => {
    const out: number[] = new Array(profile.length).fill(0)
    for (let i = 1; i < profile.length; i++) {
      const delta = profile[i].ele - profile[i - 1].ele
      out[i] = out[i - 1] + (delta > 0 ? delta : 0)
    }
    return out
  }, [profile])

  if (profile.length < 2) return null

  const toX = (km: number) => MARGIN.left + (km / maxKm) * INNER_W
  const toY = (ele: number) => MARGIN.top + INNER_H - ((ele - minEle) / eleRange) * INNER_H

  const linePoints = profile.map((p) => `${toX(p.km).toFixed(1)},${toY(p.ele).toFixed(1)}`).join(' ')
  const areaPoints = `${toX(0)},${MARGIN.top + INNER_H} ${linePoints} ${toX(maxKm)},${MARGIN.top + INNER_H}`

  const gridLines = [0, 0.5, 1].map((f) => minEle + eleRange * f)

  const current = nearestProfilePoint(profile, scrubKm)
  const currentIdx = profile.indexOf(current)
  const dotX = toX(current.km)
  const dotY = toY(current.ele)

  return (
    <div className="gpx-elevation">
      <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="gpx-elevation-chart" preserveAspectRatio="none">
        <defs>
          <linearGradient id="gpxAreaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" className="gpx-elevation-gradient-start" />
            <stop offset="100%" className="gpx-elevation-gradient-end" />
          </linearGradient>
        </defs>
        {gridLines.map((ele) => (
          <g key={ele}>
            <line
              x1={MARGIN.left}
              x2={CHART_W - MARGIN.right}
              y1={toY(ele)}
              y2={toY(ele)}
              className="gpx-elevation-grid"
            />
            <text x={MARGIN.left - 6} y={toY(ele)} className="gpx-elevation-axis-label" textAnchor="end" dy="3.5">
              {Math.round(ele)}
            </text>
          </g>
        ))}
        <text x={MARGIN.left} y={CHART_H - 4} className="gpx-elevation-axis-label">
          0 km
        </text>
        <text x={CHART_W - MARGIN.right} y={CHART_H - 4} className="gpx-elevation-axis-label" textAnchor="end">
          {maxKm.toFixed(1)} km
        </text>
        <polygon points={areaPoints} fill="url(#gpxAreaFill)" />
        <polyline points={linePoints} className="gpx-elevation-line" />
        <line x1={dotX} x2={dotX} y1={MARGIN.top} y2={MARGIN.top + INNER_H} className="gpx-elevation-cursor" />
        <circle cx={dotX} cy={dotY} r="5" className="gpx-elevation-dot" />
      </svg>
      <input
        type="range"
        className="gpx-elevation-slider"
        min={0}
        max={maxKm}
        step={maxKm / 500 || 0.01}
        value={scrubKm}
        onChange={(e) => setScrubKm(Number(e.target.value))}
        aria-label="Scorri la traccia"
      />
      <div className="gpx-scrub-stats">
        <span>
          <strong>{current.km.toFixed(2)}</strong> km
        </span>
        <span>
          <strong>{Math.round(current.ele)}</strong> m quota
        </span>
        <span>
          +<strong>{Math.round(cumGain[currentIdx] ?? 0)}</strong> m finora
        </span>
      </div>
    </div>
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
    stats?.segments.map((seg) => seg.map((p): LatLon => [p.lat, p.lon])) ?? []
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
          <ElevationChart profile={stats.profile} />
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
