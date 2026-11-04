import { ApiError, apiFetch } from './client'

export interface ProjectLocation {
  project_id: number
  name: string
  lat: number
  lon: number
  updated_at: string
}

export async function getLocation(projectId: number): Promise<ProjectLocation | null> {
  try {
    return await apiFetch<ProjectLocation>(`/projects/${projectId}/location`, { projectId })
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null
    throw err
  }
}

export function setLocation(projectId: number, input: { name: string; lat: number; lon: number }) {
  return apiFetch<ProjectLocation>(`/projects/${projectId}/location`, {
    method: 'PUT',
    body: input,
    projectId,
  })
}
