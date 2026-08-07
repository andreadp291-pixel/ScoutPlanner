import { apiFetch } from './client'

export interface ProjectMember {
  id: number
  display_name: string
  email: string
  role: 'editor' | 'viewer'
  must_change_password: boolean
  created_at: string
}

export function listMembers(projectId: number) {
  return apiFetch<ProjectMember[]>(`/projects/${projectId}/members`, { projectId })
}

export function inviteMember(
  projectId: number,
  input: { person_name: string; email: string; role: 'editor' | 'viewer' },
) {
  return apiFetch<ProjectMember>(`/projects/${projectId}/members`, {
    method: 'POST',
    body: input,
    projectId,
  })
}

export function updateMemberRole(projectId: number, projectMemberId: number, role: 'editor' | 'viewer') {
  return apiFetch<ProjectMember>(`/projects/${projectId}/members/${projectMemberId}`, {
    method: 'PATCH',
    body: { role },
    projectId,
  })
}

export function resetMemberPassword(projectId: number, projectMemberId: number) {
  return apiFetch<ProjectMember>(`/projects/${projectId}/members/${projectMemberId}/reset-password`, {
    method: 'POST',
    projectId,
  })
}

export function removeMember(projectId: number, projectMemberId: number) {
  return apiFetch<void>(`/projects/${projectId}/members/${projectMemberId}`, {
    method: 'DELETE',
    projectId,
  })
}
