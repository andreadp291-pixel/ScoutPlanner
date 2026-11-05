import { apiFetch } from './client'

export interface HistoryEntry {
  id: number
  entity: 'activity' | 'page'
  entity_id: number
  action: 'create' | 'update' | 'delete' | 'restore' | 'purge'
  actor: string
  title: string
  summary: string
  created_at: string
  restorable: boolean
}

export interface TrashItem {
  entity: 'activity' | 'page'
  id: number
  title: string
  deleted_at: string
}

export const listHistory = (projectId: number) => apiFetch<HistoryEntry[]>(`/projects/${projectId}/history`, { projectId })
export const restoreVersion = (projectId: number, logId: number) =>
  apiFetch<unknown>(`/projects/${projectId}/history/${logId}/restore`, { method: 'POST', projectId })
export const listTrash = (projectId: number) => apiFetch<TrashItem[]>(`/projects/${projectId}/trash`, { projectId })
export const restoreFromTrash = (projectId: number, t: TrashItem) =>
  apiFetch<unknown>(`/projects/${projectId}/trash/${t.entity}/${t.id}/restore`, { method: 'POST', projectId })
export const deleteForever = (projectId: number, t: TrashItem) =>
  apiFetch<void>(`/projects/${projectId}/trash/${t.entity}/${t.id}`, { method: 'DELETE', projectId })
