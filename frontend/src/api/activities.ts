import { apiFetch } from './client'

export interface Activity {
  id: number
  project_id: number
  title: string
  description: string
  location: string
  category: string
  color: string
  materials: string
  start_at: string
  end_at: string
  created_by: string
  created_at: string
  updated_at: string
  group_ids: number[]
}

export interface ActivityInput {
  title: string
  description?: string
  location?: string
  category: string
  color: string
  materials?: string
  start_at: string
  end_at: string
  group_ids?: number[]
}

export function listActivities(projectId: number) {
  return apiFetch<Activity[]>(`/projects/${projectId}/activities`, { projectId })
}

export function getActivity(projectId: number, activityId: number) {
  return apiFetch<Activity>(`/projects/${projectId}/activities/${activityId}`, { projectId })
}

export function createActivity(projectId: number, input: ActivityInput) {
  return apiFetch<Activity>(`/projects/${projectId}/activities`, {
    method: 'POST',
    body: input,
    projectId,
  })
}

export function updateActivity(projectId: number, activityId: number, input: Partial<ActivityInput>) {
  return apiFetch<Activity>(`/projects/${projectId}/activities/${activityId}`, {
    method: 'PATCH',
    body: input,
    projectId,
  })
}

export function deleteActivity(projectId: number, activityId: number) {
  return apiFetch<void>(`/projects/${projectId}/activities/${activityId}`, {
    method: 'DELETE',
    projectId,
  })
}

export function swapActivities(projectId: number, idA: number, idB: number) {
  return apiFetch<Activity[]>(`/projects/${projectId}/activities/swap`, {
    method: 'POST',
    body: { id_a: idA, id_b: idB },
    projectId,
  })
}
