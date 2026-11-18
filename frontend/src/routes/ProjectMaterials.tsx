import { canEditRole } from '../lib/roles'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { assignMaterial, listMaterials, setMaterialChi, type Material } from '../api/materials'
import { listPeople, type Person } from '../api/people'
import { listGroups, type Group } from '../api/groups'
import { getProjectAccess } from '../api/projects'
import { ArrowLeftIcon } from '../components/icons/ArrowLeftIcon'
import { Spinner } from '../components/Spinner'

function PersonSelect({
  value,
  people,
  groups = [],
  disabled,
  label,
  onChange,
}: {
  value: string | null
  people: Person[]
  groups?: Group[]
  disabled: boolean
  label: string
  onChange: (ref: string | null) => void
}) {
  const known = people.some((p) => p.ref === value) || groups.some((g) => `g${g.id}` === value)
  return (
    <select aria-label={label} value={value ?? ''} disabled={disabled} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">—</option>
      {value && !known && <option value={value}>(rimosso)</option>}
      <optgroup label="Persone">
        {people.map((p) => (
          <option key={p.ref} value={p.ref}>
            {p.name}
          </option>
        ))}
      </optgroup>
      {groups.length > 0 && (
        <optgroup label="Gruppi">
          {groups.map((g) => (
            <option key={g.id} value={`g${g.id}`}>
              {g.name}
            </option>
          ))}
        </optgroup>
      )}
    </select>
  )
}

// Lista unica dei materiali: le voci arrivano dal campo "Materiali" di ogni attività
// (tabella Cosa / Chi). Il «chi» è per attività e si cambia anche da qui; chi trasporta è per materiale.
export function ProjectMaterials() {
  const { projectId } = useParams()
  const id = Number(projectId)
  const queryClient = useQueryClient()
  const [onlyMine, setOnlyMine] = useState(false)

  const materialsQuery = useQuery({ queryKey: ['materials', id], queryFn: () => listMaterials(id) })
  const peopleQuery = useQuery({ queryKey: ['people', id], queryFn: () => listPeople(id) })
  const accessQuery = useQuery({ queryKey: ['access', id], queryFn: () => getProjectAccess(id) })
  const groupsQuery = useQuery({ queryKey: ['groups', id], queryFn: () => listGroups(id) })

  const assignMutation = useMutation({
    mutationFn: (m: Material) =>
      assignMaterial(id, { name: m.name, transport_ref: m.transport_ref }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['materials', id] }),
    onError: (err) => alert(err instanceof Error ? err.message : 'Errore durante il salvataggio'),
  })
  const chiMutation = useMutation({
    mutationFn: (input: { activity_id: number; name: string; chi: string | null }) => setMaterialChi(id, input),
    onSuccess: (_, input) => {
      queryClient.invalidateQueries({ queryKey: ['materials', id] })
      queryClient.invalidateQueries({ queryKey: ['activity', id, input.activity_id] })
      queryClient.invalidateQueries({ queryKey: ['activities', id] })
    },
    onError: (err) => alert(err instanceof Error ? err.message : 'Errore durante il salvataggio'),
  })

  if (materialsQuery.isLoading) return <Spinner label="Caricamento materiali..." />
  if (materialsQuery.error || !materialsQuery.data) return <p role="alert">Materiali non disponibili</p>

  const people = peopleQuery.data ?? []
  const canEdit = canEditRole(accessQuery.data?.role)
  const myRef = accessQuery.data?.ref
  const materials = materialsQuery.data.filter(
    (m) =>
      !onlyMine ||
      (myRef !== undefined &&
        (m.transport_ref === myRef || m.activities.some((a) => a.chi === myRef))),
  )
  const groups = groupsQuery.data ?? []
  const busy = !canEdit || assignMutation.isPending || chiMutation.isPending

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
          <ul style={{ listStyle: 'none', padding: 0, margin: '6px 0 8px', display: 'grid', gap: 6 }}>
            {m.activities
              .filter((a) => !onlyMine || m.transport_ref === myRef || a.chi === myRef)
              .map((a) => (
                <li key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Link to={`/projects/${id}/activities/${a.id}/description`} style={{ flex: '1 1 160px' }}>
                    {a.title}
                  </Link>
                  <PersonSelect
                    label={`Chi per ${a.title}`}
                    value={a.chi}
                    people={people}
                    groups={groups}
                    disabled={busy}
                    onChange={(chi) => chiMutation.mutate({ activity_id: a.id, name: m.name, chi })}
                  />
                </li>
              ))}
          </ul>
          <label>
            Chi lo trasporta
            <PersonSelect
              label="Chi lo trasporta"
              value={m.transport_ref}
              people={people}
              disabled={busy}
              onChange={(ref) => assignMutation.mutate({ ...m, transport_ref: ref })}
            />
          </label>
        </div>
      ))}
    </div>
  )
}
