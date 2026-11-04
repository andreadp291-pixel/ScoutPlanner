import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { assignMaterial, listMaterials, type Material } from '../api/materials'
import { listPeople, type Person } from '../api/people'
import { getProjectAccess } from '../api/projects'
import { ArrowLeftIcon } from '../components/icons/ArrowLeftIcon'
import { Spinner } from '../components/Spinner'

function PersonSelect({
  value,
  people,
  disabled,
  onChange,
}: {
  value: string | null
  people: Person[]
  disabled: boolean
  onChange: (ref: string | null) => void
}) {
  return (
    <select value={value ?? ''} disabled={disabled} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">—</option>
      {value && !people.some((p) => p.ref === value) && <option value={value}>(rimosso)</option>}
      {people.map((p) => (
        <option key={p.ref} value={p.ref}>
          {p.name}
        </option>
      ))}
    </select>
  )
}

// Lista unica dei materiali: le voci arrivano dal campo "Materiali" di ogni attività
// (una per riga o separate da virgola); qui si decide chi le procura e chi le trasporta.
export function ProjectMaterials() {
  const { projectId } = useParams()
  const id = Number(projectId)
  const queryClient = useQueryClient()
  const [onlyMine, setOnlyMine] = useState(false)

  const materialsQuery = useQuery({ queryKey: ['materials', id], queryFn: () => listMaterials(id) })
  const peopleQuery = useQuery({ queryKey: ['people', id], queryFn: () => listPeople(id) })
  const accessQuery = useQuery({ queryKey: ['access', id], queryFn: () => getProjectAccess(id) })

  const assignMutation = useMutation({
    mutationFn: (m: Material) =>
      assignMaterial(id, { name: m.name, procure_ref: m.procure_ref, transport_ref: m.transport_ref }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['materials', id] }),
    onError: (err) => alert(err instanceof Error ? err.message : 'Errore durante il salvataggio'),
  })

  if (materialsQuery.isLoading) return <Spinner label="Caricamento materiali..." />
  if (materialsQuery.error || !materialsQuery.data) return <p role="alert">Materiali non disponibili</p>

  const people = peopleQuery.data ?? []
  const canEdit = accessQuery.data ? accessQuery.data.role !== 'viewer' : false
  const myRef = accessQuery.data?.ref
  const materials = materialsQuery.data.filter(
    (m) => !onlyMine || (myRef !== undefined && (m.procure_ref === myRef || m.transport_ref === myRef)),
  )

  return (
    <div>
      <p>
        <Link to={`/projects/${id}`} className="btn">
          <ArrowLeftIcon />
          Torna al progetto
        </Link>
      </p>
      <h1>Materiali</h1>
      <p className="muted" style={{ marginBottom: 12 }}>
        La lista si compila da sola con i materiali scritti nelle attività.
      </p>
      <label className="group-checkbox-item" style={{ marginBottom: 12 }}>
        <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} />
        Solo quelli assegnati a me
      </label>

      {materials.length === 0 && <p className="muted">Nessun materiale.</p>}
      {materials.map((m) => (
        <div key={m.key} className="card" style={{ marginBottom: 8 }}>
          <strong>{m.name}</strong>
          <p className="muted" style={{ margin: '2px 0 8px' }}>
            {m.activities.map((a) => a.title).join(' · ')}
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <label>
              Chi lo procura
              <PersonSelect
                value={m.procure_ref}
                people={people}
                disabled={!canEdit || assignMutation.isPending}
                onChange={(ref) => assignMutation.mutate({ ...m, procure_ref: ref })}
              />
            </label>
            <label>
              Chi lo trasporta
              <PersonSelect
                value={m.transport_ref}
                people={people}
                disabled={!canEdit || assignMutation.isPending}
                onChange={(ref) => assignMutation.mutate({ ...m, transport_ref: ref })}
              />
            </label>
          </div>
        </div>
      ))}
    </div>
  )
}
