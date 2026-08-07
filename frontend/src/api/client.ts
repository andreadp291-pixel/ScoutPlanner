import { useAuthStore } from '../state/authStore'
import { useMemberAuthStore } from '../state/memberAuthStore'
import { useProjectAccessStore } from '../state/projectAccessStore'

const API_BASE = import.meta.env.VITE_API_BASE as string

export function resolveApiUrl(path: string): string {
  return `${API_BASE}${path}`
}

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
  // Se presente, la richiesta riguarda un progetto specifico: si usa, in ordine,
  // il token di condivisione anonimo salvato per quel progetto, poi la sessione
  // membro (email+password), poi la sessione owner (magic link).
  projectId?: number
  // Forza l'uso della sessione membro anche per chiamate non legate a un progetto
  // specifico (es. /me/projects).
  useMemberSession?: boolean
}

function resolveToken(options: RequestOptions): string | null {
  if (options.useMemberSession) {
    return useMemberAuthStore.getState().sessionToken
  }
  if (options.projectId !== undefined) {
    return (
      useProjectAccessStore.getState().getToken(options.projectId) ??
      useMemberAuthStore.getState().sessionToken ??
      useAuthStore.getState().sessionToken
    )
  }
  return useAuthStore.getState().sessionToken
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body } = options
  const token = resolveToken(options)

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

export async function apiUpload<T>(path: string, file: File, projectId: number): Promise<T> {
  const token = resolveToken({ projectId })
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`

  const form = new FormData()
  form.append('file', file)

  const res = await fetch(`${API_BASE}${path}`, { method: 'POST', headers, body: form })

  if (!res.ok) {
    const detail = await res.json().catch(() => ({ detail: res.statusText }))
    throw new ApiError(res.status, detail.detail ?? res.statusText)
  }
  return res.json() as Promise<T>
}
