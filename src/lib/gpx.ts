export interface GpxPoint {
  lat: number
  lon: number
  ele: number | null
}

export interface GpxStats {
  distanceKm: number
  elevationGainM: number
  elevationLossM: number
  maxAltitudeM: number | null
  minAltitudeM: number | null
  profile: { km: number; ele: number }[]
  points: GpxPoint[]
  segments: GpxPoint[][]
}

function haversineMeters(a: GpxPoint, b: GpxPoint): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

function parsePoint(el: Element): GpxPoint {
  const lat = parseFloat(el.getAttribute('lat') ?? '0')
  const lon = parseFloat(el.getAttribute('lon') ?? '0')
  const eleEl = el.getElementsByTagName('ele')[0]
  const ele = eleEl ? parseFloat(eleEl.textContent ?? '') : NaN
  return { lat, lon, ele: Number.isFinite(ele) ? ele : null }
}

export function parseGpx(xmlText: string): GpxStats {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml')
  const trksegs = Array.from(doc.getElementsByTagName('trkseg'))

  // Un GPX può avere più <trkseg> (es. per pause durante la registrazione):
  // vanno tenuti come tratti separati, altrimenti si crea una linea retta
  // spuria tra l'ultimo punto di un segmento e il primo del successivo.
  let segments: GpxPoint[][] = trksegs.map((seg) =>
    Array.from(seg.getElementsByTagName('trkpt')).map(parsePoint),
  )
  if (segments.length === 0) {
    const trkpts = Array.from(doc.getElementsByTagName('trkpt'))
    const source = trkpts.length > 0 ? trkpts : Array.from(doc.getElementsByTagName('rtept'))
    segments = source.length > 0 ? [source.map(parsePoint)] : []
  }
  segments = segments.filter((s) => s.length > 0)

  let cumKm = 0
  let elevationGainM = 0
  let elevationLossM = 0
  const profile: { km: number; ele: number }[] = []
  const points: GpxPoint[] = []

  for (const segment of segments) {
    for (let i = 0; i < segment.length; i++) {
      const point = segment[i]
      points.push(point)
      if (i > 0) {
        cumKm += haversineMeters(segment[i - 1], point) / 1000
        const eleA = segment[i - 1].ele
        const eleB = point.ele
        if (eleA !== null && eleB !== null) {
          const delta = eleB - eleA
          if (delta > 0) elevationGainM += delta
          else elevationLossM += -delta
        }
      }
      if (point.ele !== null) profile.push({ km: cumKm, ele: point.ele })
    }
  }

  let maxAltitudeM: number | null = null
  let minAltitudeM: number | null = null
  for (const p of points) {
    if (p.ele === null) continue
    if (maxAltitudeM === null || p.ele > maxAltitudeM) maxAltitudeM = p.ele
    if (minAltitudeM === null || p.ele < minAltitudeM) minAltitudeM = p.ele
  }

  return {
    distanceKm: cumKm,
    elevationGainM,
    elevationLossM,
    maxAltitudeM,
    minAltitudeM,
    profile,
    points,
    segments,
  }
}
