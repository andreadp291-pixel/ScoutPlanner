import { apiFetch } from './client'

export interface EmailPrefs {
  notifications: boolean
  report: boolean
  reminder_hour: number // ora a cui arriva il promemoria (0-23)
}

export const getEmailPrefs = () => apiFetch<EmailPrefs>('/me/email-prefs', { anySession: true })
export const setEmailPrefs = (prefs: EmailPrefs) =>
  apiFetch<EmailPrefs>('/me/email-prefs', { method: 'PUT', body: prefs, anySession: true })
