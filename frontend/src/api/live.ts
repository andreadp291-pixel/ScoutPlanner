import { apiFetch } from './client'

export interface PresenceEntry {
  ref: string
  name: string
  place: string // 'project' | 'activity:<id>' | 'page:<id>'
  editing: boolean
}

export interface NotificationItem {
  id: number
  entity: 'activity' | 'page'
  entity_id: number
  action: 'create' | 'update' | 'delete' | 'restore' | 'purge' | 'comment' | 'assign'
  actor: string
  title: string
  summary: string
  created_at: string
  unread: boolean
}

export interface Notifications {
  latest_id: number
  unread: number
  items: NotificationItem[]
}

export const sendPresence = (projectId: number, place: string, editing: boolean) =>
  apiFetch<PresenceEntry[]>(`/projects/${projectId}/presence`, { method: 'POST', body: { place, editing }, projectId })
export const getNotifications = (projectId: number) =>
  apiFetch<Notifications>(`/projects/${projectId}/notifications`, { projectId })
export const markNotificationsRead = (projectId: number) =>
  apiFetch<{ ok: boolean }>(`/projects/${projectId}/notifications/read`, { method: 'POST', projectId })
