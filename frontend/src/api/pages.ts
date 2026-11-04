import { apiFetch } from './client'

export interface ProjectPage {
  id: number
  project_id: number
  title: string
  content: string
  position: number
  created_by: string
  created_at: string
  updated_at: string
}

export function listPages(projectId: number) {
  return apiFetch<ProjectPage[]>(`/projects/${projectId}/pages`, { projectId })
}

export function createPage(projectId: number, input: { title: string; content?: string }) {
  return apiFetch<ProjectPage>(`/projects/${projectId}/pages`, { method: 'POST', body: input, projectId })
}

export function getPage(projectId: number, pageId: number) {
  return apiFetch<ProjectPage>(`/projects/${projectId}/pages/${pageId}`, { projectId })
}

export function updatePage(projectId: number, pageId: number, input: Partial<{ title: string; content: string }>) {
  return apiFetch<ProjectPage>(`/projects/${projectId}/pages/${pageId}`, {
    method: 'PATCH',
    body: input,
    projectId,
  })
}

export function deletePage(projectId: number, pageId: number) {
  return apiFetch<void>(`/projects/${projectId}/pages/${pageId}`, { method: 'DELETE', projectId })
}
