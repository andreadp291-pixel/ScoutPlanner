import L from 'leaflet'
import { useEffect, useRef } from 'react'
import type { Poi, PoiKind } from '../api/pois'

type LatLon = [number, number]

const KIND_COLOR: Record<PoiKind, string> = {
  hospital: '#c0392b',
  pharmacy: '#2e8b57',
  fire_station: '#e08e0b',
  other: '#6b6577',
}

interface PoiMapProps {
  campLocation: { name: string; lat: number; lon: number } | null
  pois: Poi[]
  visibleKinds: Set<PoiKind>
}

// Mappa Leaflet "vanilla", stesso pattern collaudato usato per la traccia GPX
// e il selettore di posizione: la mappa si crea una volta sola, i marker si
// aggiornano in un layer group separato quando cambiano POI/filtri, senza
// mai ricreare/ri-centrare la mappa sotto i piedi dell'utente.
export function PoiMap({ campLocation, pois, visibleKinds }: PoiMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const map = L.map(containerRef.current)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map)
    mapRef.current = map
    layerRef.current = L.layerGroup().addTo(map)
    return () => {
      map.remove()
      mapRef.current = null
      layerRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer) return
    layer.clearLayers()

    const points: LatLon[] = []

    if (campLocation) {
      const pos: LatLon = [campLocation.lat, campLocation.lon]
      points.push(pos)
      L.marker(pos).bindTooltip(`⛺ ${campLocation.name}`, { permanent: false }).addTo(layer)
    }

    pois
      .filter((poi) => visibleKinds.has(poi.kind) && poi.lat != null && poi.lon != null)
      .forEach((poi) => {
        const pos: LatLon = [poi.lat as number, poi.lon as number]
        points.push(pos)
        L.circleMarker(pos, {
          radius: 7,
          color: '#fff',
          weight: 2,
          fillColor: KIND_COLOR[poi.kind],
          fillOpacity: 1,
        })
          .bindTooltip(poi.name, { permanent: false })
          .addTo(layer)
      })

    if (points.length > 0) {
      map.fitBounds(L.latLngBounds(points), { padding: [30, 30], maxZoom: 15 })
    } else {
      map.setView([45.4642, 9.19], 5)
    }
  }, [campLocation, pois, visibleKinds])

  return (
    <div className="poi-map-wrap">
      <div ref={containerRef} style={{ height: 320, width: '100%' }} />
    </div>
  )
}
