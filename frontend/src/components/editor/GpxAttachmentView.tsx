import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import L from 'leaflet'
import { useEffect, useRef, useState } from 'react'
import { downsample, parseGpx, type GpxStats } from '../../lib/gpx'
import '../../lib/leafletIconFix'
import { CompassIcon } from '../icons/CompassIcon'
import { PlusIcon } from '../icons/PlusIcon'

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

// Mappa costruita con l'API imperativa di Leaflet (L.map/L.tileLayer/L.polyline),
// la stessa identica logica dello strumento di verifica indipendente in
// tools/gpx-tester — invece dei componenti dichiarativi di react-leaflet.
function GpxMap({ segments, bounds }: { segments: LatLon[][]; bounds: Bounds }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const map = L.map(containerRef.current, {
      zoomControl: false,
      scrollWheelZoom: false,
    })
    mapRef.current = map

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map)

    segments.forEach((segment) => {
      L.polyline(segment, { color: '#c0392b', weight: 3 }).addTo(map)
    })

    const allPoints = segments.flat()
    if (allPoints.length > 0) {
      L.circleMarker(allPoints[0], {
        radius: 5, color: '#fff', weight: 2, fillColor: '#2e8b57', fillOpacity: 1,
      }).addTo(map)
      L.circleMarker(allPoints[allPoints.length - 1], {
        radius: 5, color: '#fff', weight: 2, fillColor: '#c0392b', fillOpacity: 1,
      }).addTo(map)
    }

    map.fitBounds(bounds, { padding: [30, 30] })

    return () => {
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="gpx-map-wrap">
      <div ref={containerRef} style={{ height: 320, width: '100%' }} />
      <div className="map-zoom-control">
        <button type="button" onClick={() => mapRef.current?.zoomIn()} aria-label="Aumenta zoom">
          <PlusIcon size={14} />
        </button>
        <button type="button" onClick={() => mapRef.current?.zoomOut()} aria-label="Riduci zoom">
          <span className="map-zoom-minus" />
        </button>
      </div>
      <div className="map-zoom-control map-fit-control">
        <button
          type="button"
          onClick={() => mapRef.current?.fitBounds(bounds, { padding: [30, 30] })}
          aria-label="Inquadra tutto il percorso"
          title="Inquadra tutto il percorso"
        >
          <CompassIcon size={14} />
        </button>
      </div>
    </div>
  )
}

export function GpxAttachmentView({ node }: NodeViewProps) {
  const url = node.attrs.url as string
  const filename = node.attrs.filename as string
  const { stats, error } = useGpxStats(url)

  const segments: LatLon[][] =
    stats?.segments.map((seg) => downsample(seg, 1500).map((p): LatLon => [p.lat, p.lon])) ?? []
  const allPoints = segments.flat()
  const bounds = allPoints.length > 0 ? computeBounds(allPoints) : null

  return (
    <NodeViewWrapper className="gpx-card">
      <div className="gpx-card-header">
        <a href={url} download={filename} className="gpx-attachment-link">
          <CompassIcon /> {filename}
        </a>
      </div>
      {error && <p className="muted">{error}</p>}
      {!error && !stats && <p className="muted">Caricamento traccia…</p>}
      {stats && bounds && (
        <>
          <GpxMap segments={segments} bounds={bounds} />
          <GpxStatsStrip stats={stats} />
          <ElevationProfile profile={stats.profile} />
        </>
      )}
    </NodeViewWrapper>
  )
}
