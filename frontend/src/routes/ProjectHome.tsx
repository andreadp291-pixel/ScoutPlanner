import { useViewModeStore } from '../state/viewModeStore'
import { ProjectCalendar } from './ProjectCalendar'
import { ProjectView } from './ProjectView'

// Punto d'ingresso di /projects/:projectId: sceglie tra la modalità
// visualizza (default, sola lettura) e la modalità editing esistente
// (ProjectCalendar, invariata) in base allo switch globale in Layout.
export function ProjectHome() {
  const mode = useViewModeStore((s) => s.mode)
  return mode === 'edit' ? <ProjectCalendar /> : <ProjectView />
}
