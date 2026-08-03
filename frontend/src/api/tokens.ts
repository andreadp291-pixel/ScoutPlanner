import { apiFetch } from './client'

export interface ProjectToken {
  id: number
  person_name: string
  role: 'editor' | 'viewer'
  revoked_at: string | null
  created_at: string
  last_used_at: string | null
}

export interface ProjectTokenCreated extends ProjectToken {
  raw_token: string
}

export function listTokens(projectId: number) {
  return apiFetch<ProjectToken[]>(`/projects/${projectId}/tokens`, { projectId })
}

export function createToken(projectId: number, input: { person_name: string; role: 'editor' | 'viewer' }) {
  return apiFetch<ProjectTokenCreated>(`/projects/${projectId}/tokens`, {
    method: 'POST',
    body: input,
    projectId,
  })
}

export function regenerateToken(projectId: number, tokenId: number) {
  return apiFetch<ProjectTokenCreated>(`/projects/${projectId}/tokens/${tokenId}/regenerate`, {
    method: 'POST',
    projectId,
  })
}

export function revokeToken(projectId: number, tokenId: number) {
  return apiFetch<void>(`/projects/${projectId}/tokens/${tokenId}`, { method: 'DELETE', projectId })
}
