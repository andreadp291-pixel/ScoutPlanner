import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { createGroup, deleteGroup, groupColor, listGroups, updateGroup, type Group } from '../api/groups'
import { getProjectAccess } from '../api/projects'
import { Spinner } from '../components/Spinner'
import { canEditRole } from '../lib/roles'

// Gruppi (squadriglie, branchi…) da assegnare alle attività; il colore è quello dei bollini nel calendario.
export function ProjectGroups() {
  const id = Number(useParams().projectId)
  const queryClient = useQueryClient()
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingName, setEditingName] = useState('')

  const groupsQuery = useQuery({ queryKey: ['groups', id], queryFn: () => listGroups(id) })
  const accessQuery = useQuery({ queryKey: ['access', id], queryFn: () => getProjectAccess(id) })
  const canEdit = canEditRole(accessQuery.data?.role)

  const onError = (err: unknown) => alert(err instanceof Error ? err.message : 'Errore durante il salvataggio')
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['groups', id] })
  const createMutation = useMutation({ mutationFn: (name: string) => createGroup(id, name), onSuccess: invalidate, onError })
  const updateMutation = useMutation({
    mutationFn: ({ groupId, ...input }: { groupId: number; name?: string; color?: string }) => updateGroup(id, groupId, input),
    onSuccess: invalidate,
    onError,
  })
  const deleteMutation = useMutation({
    mutationFn: (groupId: number) => deleteGroup(id, groupId),
    onSuccess: () => {
      invalidate()
      queryClient.invalidateQueries({ queryKey: ['activities', id] })
    },
    onError,
  })

  if (groupsQuery.isLoading) return <Spinner label="Caricamento gruppi..." />
  const groups = groupsQuery.data ?? []

  function confirmEdit() {
    const name = editingName.trim()
    if (editingId !== null && name) updateMutation.mutate({ groupId: editingId, name })
    setEditingId(null)
  }

  function remove(g: Group) {
    if (window.confirm(`Eliminare il gruppo «${g.name}»? Verrà tolto da tutte le attività.`)) deleteMutation.mutate(g.id)
  }

  return (
    <div>
      <h1>Gruppi</h1>
      <p className="muted" style={{ marginBottom: 12 }}>
        Gruppi (es. squadriglie) da assegnare alle attività. Il colore è quello del bollino nel calendario.
      </p>

      <ul className="project-list" style={{ marginBottom: 16 }}>
        {groups.map((g) => (
          <li key={g.id}>
            <input
              type="color"
              aria-label={`Colore di ${g.name}`}
              value={groupColor(g)}
              disabled={!canEdit}
              onChange={(e) => updateMutation.mutate({ groupId: g.id, color: e.target.value })}
              style={{ width: 36, height: 32, padding: 2, flex: 'none' }}
            />
            {editingId === g.id ? (
              <>
                <input
                  autoFocus
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && confirmEdit()}
                  style={{ flex: 1 }}
                />
                <button type="button" onClick={confirmEdit}>
                  Salva
                </button>
              </>
            ) : (
              <>
                <span style={{ flex: 1 }}>{g.name}</span>
                {canEdit && (
                  <>
                    <button type="button" onClick={() => { setEditingId(g.id); setEditingName(g.name) }}>
                      Rinomina
                    </button>
                    <button type="button" className="danger" onClick={() => remove(g)}>
                      Elimina
                    </button>
                  </>
                )}
              </>
            )}
          </li>
        ))}
        {groups.length === 0 && <p className="muted">Nessun gruppo ancora.</p>}
      </ul>

      {canEdit && (
        <form
          className="location-search-row"
          onSubmit={(e) => {
            e.preventDefault()
            if (!newName.trim()) return
            createMutation.mutate(newName.trim())
            setNewName('')
          }}
        >
          <input placeholder="Nome nuovo gruppo…" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <button type="submit" className="primary" disabled={!newName.trim()}>
            Crea
          </button>
        </form>
      )}
    </div>
  )
}
