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

export interface Profile {
  email: string
  name: string
}

export const getProfile = () => apiFetch<Profile>('/me/profile', { anySession: true })
export const setProfile = (name: string) =>
  apiFetch<Profile>('/me/profile', { method: 'PUT', body: { name }, anySession: true })
