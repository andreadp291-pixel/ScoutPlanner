import { create } from 'zustand'

interface AuthState {
  sessionToken: string | null
  email: string | null
  setSession: (token: string, email: string) => void
  logout: () => void
}

const STORAGE_KEY = 'scoutplanner.owner-session'

function loadInitial(): { sessionToken: string | null; email: string | null } {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return { sessionToken: null, email: null }
  try {
    return JSON.parse(raw)
  } catch {
    return { sessionToken: null, email: null }
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  ...loadInitial(),
  setSession: (token, email) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ sessionToken: token, email }))
    set({ sessionToken: token, email })
  },
  logout: () => {
    localStorage.removeItem(STORAGE_KEY)
    set({ sessionToken: null, email: null })
  },
}))
