import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { listActivities } from '../api/activities'
import { listGroups } from '../api/groups'
import { listPeople } from '../api/people'
import { getProject } from '../api/projects'
import { dateRange, formatDayLabel } from '../components/calendar/time'
import { BlockEditor } from '../components/editor/BlockEditor'
import { isDocEmpty, parseActivityDoc } from '../components/editor/blocks'
import { NoAccess } from '../components/NoAccess'
import { Spinner } from '../components/Spinner'

// Vademecum da stampare: una pagina per giorno. «Salva come PDF» dal dialogo di stampa del browser.
export function ProjectPrint() {
  const id = Number(useParams().projectId)
  const projectQuery = useQuery({ queryKey: ['project', id], queryFn: () => getProject(id) })
  const activitiesQuery = useQuery({ queryKey: ['activities', id], queryFn: () => listActivities(id) })
  const groupsQuery = useQuery({ queryKey: ['groups', id], queryFn: () => listGroups(id) })
  const peopleQuery = useQuery({ queryKey: ['people', id], queryFn: () => listPeople(id) })

  if (projectQuery.isLoading || activitiesQuery.isLoading) return <Spinner label="Preparo il documento..." />
  const project = projectQuery.data
  if (!project) return <NoAccess projectId={id} />

  const groupName = new Map((groupsQuery.data ?? []).map((g) => [g.id, g.name]))
  const personName = new Map((peopleQuery.data ?? []).map((p) => [p.ref, p.name]))
  const all = activitiesQuery.data ?? []
  const days = dateRange(project.start_date, project.end_date)

  return (
    <div className="print-doc">
      <div className="print-bar">
        <Link to={`/projects/${id}`} className="btn">← Torna al progetto</Link>
        <button type="button" className="primary" onClick={() => window.print()}>Stampa / Salva come PDF</button>
        <span className="muted">Nel dialogo scegli «Salva come PDF» come stampante.</span>
      </div>
      {days.map((day) => {
        const items = all.filter((a) => a.start_at.startsWith(day)).sort((a, b) => a.start_at.localeCompare(b.start_at))
        return (
          <section key={day} className="print-day">
            <h1>{formatDayLabel(day)}</h1>
            <p className="muted print-sub">{project.name}</p>
            {items.length === 0 && <p className="muted">Nessuna attività.</p>}
            {items.map((a) => {
              const doc = parseActivityDoc(a.description)
              const meta = [
                a.group_ids.map((g) => groupName.get(g)).filter(Boolean).join(', '),
                a.assignees.map((r) => personName.get(r)).filter(Boolean).join(', '),
                a.location,
              ].filter(Boolean)
              return (
                <article key={a.id} className="print-act">
                  <h2>
                    <span className="print-time">{a.start_at.slice(11, 16)}–{a.end_at.slice(11, 16)}</span> {a.title}
                  </h2>
                  {meta.length > 0 && <p className="muted">{meta.join(' · ')}</p>}
                  {!isDocEmpty(doc) && <BlockEditor projectId={id} content={doc} editable={false} />}
                  {a.materials && <p><strong>Materiali:</strong> {a.materials}</p>}
                </article>
              )
            })}
          </section>
        )
      })}
    </div>
  )
}

