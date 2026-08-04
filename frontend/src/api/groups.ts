import { apiFetch } from './client'

export interface Group {
  id: number
  project_id: number
  name: string
  created_at: string
}

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

export function renameGroup(projectId: number, groupId: number, name: string) {
  return apiFetch<Group>(`/projects/${projectId}/groups/${groupId}`, {
    method: 'PATCH',
    body: { name },
    projectId,
  })
}

export function deleteGroup(projectId: number, groupId: number) {
  return apiFetch<void>(`/projects/${projectId}/groups/${groupId}`, {
    method: 'DELETE',
    projectId,
  })
}
