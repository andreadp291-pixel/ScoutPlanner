import type { Role } from '../lib/roles'
import { apiFetch } from './client'

export interface Comment {
  id: number
  entity: 'activity' | 'page'
  entity_id: number
  parent_id: number | null
  author: string
  author_ref: string
  body: string
  resolved_at: string | null
  created_at: string
}

export const listComments = (projectId: number, entity: Comment['entity'], entityId: number) =>
  apiFetch<Comment[]>(`/projects/${projectId}/comments?entity=${entity}&entity_id=${entityId}`, { projectId })
export const addComment = (
  projectId: number,
  input: { entity: Comment['entity']; entity_id: number; body: string; parent_id?: number },
) => apiFetch<Comment>(`/projects/${projectId}/comments`, { method: 'POST', body: input, projectId })
export const resolveComment = (projectId: number, id: number, resolved: boolean) =>
  apiFetch<Comment>(`/projects/${projectId}/comments/${id}`, { method: 'PATCH', body: { resolved }, projectId })
export const deleteComment = (projectId: number, id: number) =>
  apiFetch<void>(`/projects/${projectId}/comments/${id}`, { method: 'DELETE', projectId })

export interface AccessRequest {
  id: number
  email: string
  name: string
  message: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
}

export const requestAccess = (projectId: number, input: { name?: string; message?: string }) =>
  apiFetch<AccessRequest>(`/projects/${projectId}/access-requests`, { method: 'POST', body: input, projectId })
export const listAccessRequests = (projectId: number) =>
  apiFetch<AccessRequest[]>(`/projects/${projectId}/access-requests`, { projectId })
export const approveAccessRequest = (projectId: number, id: number, role: Role) =>
  apiFetch<AccessRequest>(`/projects/${projectId}/access-requests/${id}/approve`, { method: 'POST', body: { role }, projectId })
export const rejectAccessRequest = (projectId: number, id: number) =>
  apiFetch<AccessRequest>(`/projects/${projectId}/access-requests/${id}/reject`, { method: 'POST', projectId })

export const sendReportNow = (projectId: number) =>
  apiFetch<{ ok: boolean }>(`/projects/${projectId}/report/send`, { method: 'POST', projectId })

export const sendRemindersNow = (projectId: number) =>
  apiFetch<{ ok: boolean }>(`/projects/${projectId}/report/remind`, { method: 'POST', projectId })

export const transferOwnership = (projectId: number, email: string) =>
  apiFetch<{ ok: boolean }>(`/projects/${projectId}/transfer`, { method: 'POST', body: { email }, projectId })
