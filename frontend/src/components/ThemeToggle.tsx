import { useThemeStore } from '../state/themeStore'
import { MoonIcon } from './icons/MoonIcon'
import { SunIcon } from './icons/SunIcon'

export function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme)
  const toggle = useThemeStore((s) => s.toggle)

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Passa alla modalità giorno' : 'Passa alla modalità notte'}
      title={theme === 'dark' ? 'Modalità giorno' : 'Modalità notte'}
    >
      {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
    </button>
  )
}
