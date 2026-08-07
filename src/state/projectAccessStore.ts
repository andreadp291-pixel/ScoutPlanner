import { create } from 'zustand'

interface ProjectAccessState {
  tokensByProject: Record<number, string>
  setToken: (projectId: number, token: string) => void
  getToken: (projectId: number) => string | undefined
}

const STORAGE_KEY = 'scoutplanner.share-tokens'

function loadInitial(): Record<number, string> {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return {}
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

export const useProjectAccessStore = create<ProjectAccessState>((set, get) => ({
  tokensByProject: loadInitial(),
  setToken: (projectId, token) => {
    const next = { ...get().tokensByProject, [projectId]: token }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    set({ tokensByProject: next })
  },
  getToken: (projectId) => get().tokensByProject[projectId],
}))
