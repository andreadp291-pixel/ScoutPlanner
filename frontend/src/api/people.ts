import { apiFetch } from './client'

export interface Person {
  ref: string // 'o' = owner, 'm<id>' = membro con account, 't<id>' = persona con link
  name: string
  kind: 'owner' | 'member' | 'link'
}

export function listPeople(projectId: number) {
  return apiFetch<Person[]>(`/projects/${projectId}/people`, { projectId })
}
