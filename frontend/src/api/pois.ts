import { apiFetch } from './client'

export type PoiKind = 'hospital' | 'pharmacy' | 'fire_station' | 'other'

export interface Poi {
  id: number
  project_id: number
  kind: PoiKind
  name: string
  phone: string
  address: string
  lat: number | null
  lon: number | null
  notes: string
  hours: string
  created_at: string
}

export interface PoiInput {
  kind: PoiKind
  name: string
  phone?: string
  address?: string
  lat?: number | null
  lon?: number | null
  notes?: string
  hours?: string
}

export function listPois(projectId: number) {
  return apiFetch<Poi[]>(`/projects/${projectId}/pois`, { projectId })
}

export function createPoi(projectId: number, input: PoiInput) {
  return apiFetch<Poi>(`/projects/${projectId}/pois`, { method: 'POST', body: input, projectId })
}

export function updatePoi(projectId: number, poiId: number, input: Partial<PoiInput>) {
  return apiFetch<Poi>(`/projects/${projectId}/pois/${poiId}`, { method: 'PATCH', body: input, projectId })
}

export function deletePoi(projectId: number, poiId: number) {
  return apiFetch<void>(`/projects/${projectId}/pois/${poiId}`, { method: 'DELETE', projectId })
}
