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

export interface ProjectAccess {
  role: 'owner' | 'editor' | 'viewer'
  name: string
}

export function getProjectAccess(projectId: number) {
  return apiFetch<ProjectAccess>(`/projects/${projectId}/access`, { projectId })
}

export function deleteProject(projectId: number) {
  return apiFetch<void>(`/projects/${projectId}`, { method: 'DELETE', projectId })
}
