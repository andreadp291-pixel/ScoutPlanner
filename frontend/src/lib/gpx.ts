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

export function downsample<T>(arr: T[], maxPoints: number): T[] {
  if (arr.length <= maxPoints) return arr
  const step = arr.length / maxPoints
  const out: T[] = []
  for (let i = 0; i < maxPoints; i++) out.push(arr[Math.floor(i * step)])
  return out
}

export function parseGpx(xmlText: string): GpxStats {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml')
  const trkpts = Array.from(doc.getElementsByTagName('trkpt'))
  const source = trkpts.length > 0 ? trkpts : Array.from(doc.getElementsByTagName('rtept'))

  const points: GpxPoint[] = source.map((el) => {
    const lat = parseFloat(el.getAttribute('lat') ?? '0')
    const lon = parseFloat(el.getAttribute('lon') ?? '0')
    const eleEl = el.getElementsByTagName('ele')[0]
    const ele = eleEl ? parseFloat(eleEl.textContent ?? '') : NaN
    return { lat, lon, ele: Number.isFinite(ele) ? ele : null }
  })

  let cumKm = 0
  let elevationGainM = 0
  let elevationLossM = 0
  const profile: { km: number; ele: number }[] = []

  for (let i = 0; i < points.length; i++) {
    if (i > 0) {
      cumKm += haversineMeters(points[i - 1], points[i]) / 1000
      const eleA = points[i - 1].ele
      const eleB = points[i].ele
      if (eleA !== null && eleB !== null) {
        const delta = eleB - eleA
        if (delta > 0) elevationGainM += delta
        else elevationLossM += -delta
      }
    }
    const ele = points[i].ele
    if (ele !== null) profile.push({ km: cumKm, ele })
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
    profile: downsample(profile, 200),
    points,
  }
}
