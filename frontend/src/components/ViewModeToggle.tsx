import { useViewModeStore } from '../state/viewModeStore'
import { EyeIcon } from './icons/EyeIcon'
import { PencilIcon } from './icons/PencilIcon'

export function ViewModeToggle() {
  const mode = useViewModeStore((s) => s.mode)
  const toggle = useViewModeStore((s) => s.toggle)

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={mode === 'edit' ? 'Passa a modalità visualizza' : 'Passa a modalità modifica'}
      title={mode === 'edit' ? 'Modalità visualizza' : 'Modalità modifica'}
    >
      {mode === 'edit' ? <EyeIcon /> : <PencilIcon />}
    </button>
  )
}
