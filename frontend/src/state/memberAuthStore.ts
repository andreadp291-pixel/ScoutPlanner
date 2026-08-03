import { create } from 'zustand'

interface MemberAuthState {
  sessionToken: string | null
  displayName: string | null
  setSession: (token: string, displayName: string) => void
  logout: () => void
}

const STORAGE_KEY = 'scoutplanner.member-session'

function loadInitial(): { sessionToken: string | null; displayName: string | null } {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return { sessionToken: null, displayName: null }
  try {
    return JSON.parse(raw)
  } catch {
    return { sessionToken: null, displayName: null }
  }
}

export const useMemberAuthStore = create<MemberAuthState>((set) => ({
  ...loadInitial(),
  setSession: (token, displayName) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ sessionToken: token, displayName }))
    set({ sessionToken: token, displayName })
  },
  logout: () => {
    localStorage.removeItem(STORAGE_KEY)
    set({ sessionToken: null, displayName: null })
  },
}))
