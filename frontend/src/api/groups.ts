import { apiFetch } from './client'

export interface Group {
  id: number
  project_id: number
  name: string
  color: string | null // '#rrggbb'; null = colore automatico
  created_at: string
}

// Tavolozza automatica (--g0..--g5 in design.css) finché non si sceglie un colore.
export const PALETTE = ['#d4572b', '#3f8f5f', '#5b86a8', '#7a5fb3', '#d98a1f', '#b04a7a']
export const groupColor = (g: Pick<Group, 'id' | 'color'>) => g.color ?? PALETTE[g.id % 6]

export function listGroups(projectId: number) {
  return apiFetch<Group[]>(`/projects/${projectId}/groups`, { projectId })
}

export function createGroup(projectId: number, name: string) {
  return apiFetch<Group>(`/projects/${projectId}/groups`, {
    method: 'POST',
    body: { name },
    projectId,
  })
}

export function updateGroup(projectId: number, groupId: number, input: { name?: string; color?: string }) {
  return apiFetch<Group>(`/projects/${projectId}/groups/${groupId}`, {
    method: 'PATCH',
    body: input,
    projectId,
  })
}

export function deleteGroup(projectId: number, groupId: number) {
  return apiFetch<void>(`/projects/${projectId}/groups/${groupId}`, {
    method: 'DELETE',
    projectId,
  })
}
