import { create } from 'zustand'

interface MemberAuthState {
  sessionToken: string | null
  displayName: string | null
  mustChangePassword: boolean
  setSession: (token: string, displayName: string, mustChangePassword: boolean) => void
  logout: () => void
}

const STORAGE_KEY = 'scoutplanner.member-session'

interface StoredState {
  sessionToken: string | null
  displayName: string | null
  mustChangePassword: boolean
}

function loadInitial(): StoredState {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return { sessionToken: null, displayName: null, mustChangePassword: false }
  try {
    const parsed = JSON.parse(raw)
    return {
      sessionToken: parsed.sessionToken ?? null,
      displayName: parsed.displayName ?? null,
      mustChangePassword: Boolean(parsed.mustChangePassword),
    }
  } catch {
    return { sessionToken: null, displayName: null, mustChangePassword: false }
  }
}

export const useMemberAuthStore = create<MemberAuthState>((set) => ({
  ...loadInitial(),
  setSession: (token, displayName, mustChangePassword) => {
    const next: StoredState = { sessionToken: token, displayName, mustChangePassword }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    set(next)
  },
  logout: () => {
    localStorage.removeItem(STORAGE_KEY)
    set({ sessionToken: null, displayName: null, mustChangePassword: false })
  },
}))
