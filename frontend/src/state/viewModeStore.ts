import { create } from 'zustand'

export type ViewMode = 'view' | 'edit'

const STORAGE_KEY = 'scoutplanner.viewMode'

function loadInitial(): ViewMode {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'view' || stored === 'edit') return stored
  return 'view'
}

interface ViewModeState {
  mode: ViewMode
  toggle: () => void
}

export const useViewModeStore = create<ViewModeState>((set, get) => ({
  mode: loadInitial(),
  toggle: () => {
    const next: ViewMode = get().mode === 'edit' ? 'view' : 'edit'
    localStorage.setItem(STORAGE_KEY, next)
    set({ mode: next })
  },
}))
