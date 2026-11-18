import { apiFetch } from './client'

export interface Material {
  key: string
  name: string
  activities: { id: number; title: string; chi: string | null }[] // chi = ref persona o 'g<id>' dalla tabella dell'attività
  transport_ref: string | null
}

export function listMaterials(projectId: number) {
  return apiFetch<Material[]>(`/projects/${projectId}/materials`, { projectId })
}

export function assignMaterial(
  projectId: number,
  input: { name: string; transport_ref: string | null },
) {
  return apiFetch<Material>(`/projects/${projectId}/materials`, { method: 'PUT', body: input, projectId })
}

// «Chi» del materiale dentro una sola attività (lo stesso della tabella nella pagina dell'attività).
export function setMaterialChi(projectId: number, input: { activity_id: number; name: string; chi: string | null }) {
  return apiFetch<void>(`/projects/${projectId}/materials/chi`, { method: 'PUT', body: input, projectId })
}
