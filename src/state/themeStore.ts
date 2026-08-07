import { create } from 'zustand'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'scoutplanner.theme'

function systemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function loadInitial(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return systemPrefersDark() ? 'dark' : 'light'
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
}

interface ThemeState {
  theme: Theme
  toggle: () => void
}

const initialTheme = loadInitial()
applyTheme(initialTheme)

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: initialTheme,
  toggle: () => {
    const next: Theme = get().theme === 'dark' ? 'light' : 'dark'
    localStorage.setItem(STORAGE_KEY, next)
    applyTheme(next)
    set({ theme: next })
  },
}))
