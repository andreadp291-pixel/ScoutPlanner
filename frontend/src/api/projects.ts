import { apiFetch } from './client'

export interface Project {
  id: number
  name: string
  owner_email: string
  start_date: string
  end_date: string
  created_at: string
}

export function listProjects() {
  return apiFetch<Project[]>('/projects')
}

export function createProject(input: { name: string; start_date: string; end_date: string }) {
  return apiFetch<Project>('/projects', { method: 'POST', body: input })
}

export function getProject(projectId: number) {
  return apiFetch<Project>(`/projects/${projectId}`, { projectId })
}
