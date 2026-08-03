import { apiFetch } from './client'

export function requestLink(email: string) {
  return apiFetch<{ detail: string }>('/auth/request-link', { method: 'POST', body: { email } })
}

export function verifyLink(token: string) {
  return apiFetch<{ session_token: string; email: string }>(
    `/auth/verify?token=${encodeURIComponent(token)}`,
  )
}
