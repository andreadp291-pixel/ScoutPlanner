import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { useEffect, useState } from 'react'
import { MapContainer, Polyline, TileLayer, useMap } from 'react-leaflet'
import { downsample, parseGpx, type GpxStats } from '../../lib/gpx'
import '../../lib/leafletIconFix'
import { CompassIcon } from '../icons/CompassIcon'

// Il NodeView di TipTap può montare la mappa prima che il layout della pagina
// (font, colonne, contenuto circostante) si sia stabilizzato. invalidateSize()
// è l'API di Leaflet pensata apposta per questo: ricalcola la dimensione senza
// rifare fitBounds (che rieseguito a freddo può disallineare temporaneamente
// tile e traccia vettoriale finché non si ridisegnano insieme).
function MapSizeFix() {
  const map = useMap()
  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 250)
    return () => clearTimeout(timer)
  }, [map])
  return null
}

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

function computeBounds(points: [number, number][]): [[number, number], [number, number]] {
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

export function GpxAttachmentView({ node }: NodeViewProps) {
  const url = node.attrs.url as string
  const filename = node.attrs.filename as string
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

  const trackSegments: [number, number][][] =
    stats?.segments.map((seg) => downsample(seg, 1500).map((p): [number, number] => [p.lat, p.lon])) ?? []
  const allTrackPoints = trackSegments.flat()
  const bounds = allTrackPoints.length > 0 ? computeBounds(allTrackPoints) : null

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
          <div className="gpx-map-wrap">
            <MapContainer
              bounds={bounds}
              style={{ height: 260, width: '100%' }}
              scrollWheelZoom={false}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {trackSegments.map((segment, i) => (
                <Polyline key={i} positions={segment} pathOptions={{ color: '#c0392b', weight: 3 }} />
              ))}
              <MapSizeFix />
            </MapContainer>
          </div>
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
          <ElevationProfile profile={stats.profile} />
        </>
      )}
    </NodeViewWrapper>
  )
}
