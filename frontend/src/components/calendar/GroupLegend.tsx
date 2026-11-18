import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { groupColor, listGroups } from '../../api/groups'

// Legenda dei bollini colorati dei gruppi sulle attività.
export function GroupLegend() {
  const id = Number(useParams().projectId)
  const groups = useQuery({ queryKey: ['groups', id], queryFn: () => listGroups(id) }).data ?? []
  if (groups.length === 0) return null
  return (
    <div className="group-legend" aria-label="Legenda gruppi">
      {groups.map((g) => (
        <span key={g.id}>
          <i className="gd" style={{ background: groupColor(g) }} /> {g.name}
        </span>
      ))}
    </div>
  )
}
