import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { deleteProject, listProjects } from '../api/projects'
import { formatShortDate } from '../components/calendar/time'
import { PlusIcon } from '../components/icons/PlusIcon'
import { TrashIcon } from '../components/icons/TrashIcon'
import { Spinner } from '../components/Spinner'

export function ProjectList() {
  const queryClient = useQueryClient()
  const { data, isLoading, error } = useQuery({ queryKey: ['projects'], queryFn: listProjects })
  const [selected, setSelected] = useState<Set<number>>(() => new Set())
  const [deleteArmed, setDeleteArmed] = useState(false)

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      for (const projectId of ids) await deleteProject(projectId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      setSelected(new Set())
      setDeleteArmed(false)
    },
    onError: (err) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      setDeleteArmed(false)
      alert(err instanceof Error ? err.message : "Errore durante l'eliminazione")
    },
  })

  if (isLoading) return <Spinner label="Caricamento progetti..." />
  if (error) return <p role="alert">Errore nel caricamento dei progetti</p>

  function toggleSelected(id: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setDeleteArmed(false)
  }

  function handleDeleteSelectedClick() {
    if (selected.size === 0) return
    if (!deleteArmed) {
      setDeleteArmed(true)
      return
    }
    bulkDeleteMutation.mutate([...selected])
  }

  return (
    <div>
      <h1>I tuoi progetti</h1>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        <Link to="/projects/new">
          <button type="button" className="primary">
            <PlusIcon />
            Nuovo progetto
          </button>
        </Link>
        {selected.size > 0 && (
          <button
            type="button"
            className="danger"
            onClick={handleDeleteSelectedClick}
            onBlur={() => setDeleteArmed(false)}
            disabled={bulkDeleteMutation.isPending}
          >
            <TrashIcon />
            {deleteArmed ? 'Confermi?' : `Elimina selezionati (${selected.size})`}
          </button>
        )}
      </div>
      <ul className="project-list">
        {data?.map((p) => (
          <li key={p.id} className={selected.has(p.id) ? 'selected' : ''}>
            <input
              type="checkbox"
              aria-label={`Seleziona ${p.name}`}
              checked={selected.has(p.id)}
              onChange={() => toggleSelected(p.id)}
            />
            <Link to={`/projects/${p.id}`}>
              {p.name}
              <div className="dates">
                {formatShortDate(p.start_date)} → {formatShortDate(p.end_date)}
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {data?.length === 0 && <p className="muted">Nessun progetto ancora. Creane uno per iniziare.</p>}
    </div>
  )
}
