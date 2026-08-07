import { apiFetch } from './client'

export interface MemberProject {
  id: number
  name: string
  start_date: string
  end_date: string
  role: 'editor' | 'viewer'
}

export function getMyProjects() {
  return apiFetch<MemberProject[]>('/me/projects', { useMemberSession: true })
}
