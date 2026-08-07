import { apiFetch } from './client'

export function requestLink(email: string) {
  return apiFetch<{ detail: string }>('/auth/request-link', { method: 'POST', body: { email } })
}

export function verifyLink(token: string) {
  return apiFetch<{ session_token: string; email: string }>(
    `/auth/verify?token=${encodeURIComponent(token)}`,
  )
}

export interface MemberSession {
  session_token: string
  display_name: string
  must_change_password: boolean
}

export function memberLogin(email: string, password: string) {
  return apiFetch<MemberSession>('/auth/member/login', { method: 'POST', body: { email, password } })
}

export function memberChangePassword(newPassword: string) {
  return apiFetch<MemberSession>('/auth/member/change-password', {
    method: 'POST',
    body: { new_password: newPassword },
    useMemberSession: true,
  })
}

export interface OwnerSession {
  session_token: string
  email: string
}

export function ownerLogin(email: string, password: string) {
  return apiFetch<OwnerSession>('/auth/owner/login', { method: 'POST', body: { email, password } })
}

export function ownerSetPassword(newPassword: string) {
  return apiFetch<OwnerSession>('/auth/owner/set-password', {
    method: 'POST',
    body: { new_password: newPassword },
  })
}
