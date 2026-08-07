const API_KEY = import.meta.env.VITE_TOMTOM_API_KEY as string | undefined

export function hasTomTomKey(): boolean {
  return !!API_KEY
}

export interface TravelTimeResult {
  durationMin: number
  distanceKm: number
  trafficDelayMin: number
}

export async function calculateTravelTime(
  origin: { lat: number; lon: number },
  destination: { lat: number; lon: number },
): Promise<TravelTimeResult> {
  if (!API_KEY) {
    throw new Error('Chiave TomTom non configurata (VITE_TOMTOM_API_KEY)')
  }
  const url =
    `https://api.tomtom.com/routing/1/calculateRoute/` +
    `${origin.lat},${origin.lon}:${destination.lat},${destination.lon}/json` +
    `?key=${encodeURIComponent(API_KEY)}&traffic=true`

  const res = await fetch(url)
  if (!res.ok) throw new Error('Calcolo del tempo di viaggio non riuscito')
  const data = await res.json()
  const summary = data?.routes?.[0]?.summary
  if (!summary) throw new Error('Nessun percorso trovato')

  return {
    durationMin: Math.round(summary.travelTimeInSeconds / 60),
    distanceKm: Math.round((summary.lengthInMeters / 1000) * 10) / 10,
    trafficDelayMin: Math.round((summary.trafficDelayInSeconds ?? 0) / 60),
  }
}
