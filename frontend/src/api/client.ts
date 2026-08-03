import { useAuthStore } from '../state/authStore'
import { useProjectAccessStore } from '../state/projectAccessStore'

const API_BASE = import.meta.env.VITE_API_BASE as string

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

interface RequestOptions {
  method?: string
  body?: unknown
  projectId?: number // se presente, usa il token di condivisione per quel progetto invece della sessione owner
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, projectId } = options

  const token = projectId
    ? useProjectAccessStore.getState().getToken(projectId) ?? useAuthStore.getState().sessionToken
    : useAuthStore.getState().sessionToken

  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const detail = await res.json().catch(() => ({ detail: res.statusText }))
    throw new ApiError(res.status, detail.detail ?? res.statusText)
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}
