export interface TravelTimeResult {
  durationMin: number
  distanceKm: number
}

// Servizio demo pubblico OSRM: gratuito, nessuna chiave, nessuna registrazione.
// Nota bene: nessun dato di traffico in tempo reale, solo stima da rete
// stradale e limiti di velocità.
export async function calculateTravelTimeOSRM(
  origin: { lat: number; lon: number },
  destination: { lat: number; lon: number },
): Promise<TravelTimeResult> {
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${origin.lon},${origin.lat};${destination.lon},${destination.lat}` +
    `?overview=false`

  const res = await fetch(url)
  if (!res.ok) throw new Error('Calcolo del tempo di viaggio non riuscito')
  const data = await res.json()
  const route = data?.routes?.[0]
  if (!route) throw new Error('Nessun percorso trovato')

  return {
    durationMin: Math.round(route.duration / 60),
    distanceKm: Math.round((route.distance / 1000) * 10) / 10,
  }
}
