import L from 'leaflet'

// Vite non risolve i path relativi delle immagini che Leaflet usa di default
// per i marker; si punta alle stesse immagini via CDN (fix standard per i bundler).
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl

L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})
