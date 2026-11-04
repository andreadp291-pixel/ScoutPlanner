import { apiFetch } from './client'

export interface Material {
  key: string
  name: string
  activities: { id: number; title: string }[]
  procure_ref: string | null
  transport_ref: string | null
}

export function listMaterials(projectId: number) {
  return apiFetch<Material[]>(`/projects/${projectId}/materials`, { projectId })
}

export function assignMaterial(
  projectId: number,
  input: { name: string; procure_ref: string | null; transport_ref: string | null },
) {
  return apiFetch<Material>(`/projects/${projectId}/materials`, { method: 'PUT', body: input, projectId })
}
