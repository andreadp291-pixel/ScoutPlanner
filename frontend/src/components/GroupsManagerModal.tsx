import { useState } from 'react'
import type { Group } from '../api/groups'

interface GroupsManagerModalProps {
  groups: Group[]
  onCreate: (name: string) => void
  onRename: (groupId: number, name: string) => void
  onDelete: (groupId: number) => void
  onClose: () => void
}

export function GroupsManagerModal({ groups, onCreate, onRename, onDelete, onClose }: GroupsManagerModalProps) {
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingName, setEditingName] = useState('')

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    onCreate(name)
    setNewName('')
  }

  function startEdit(g: Group) {
    setEditingId(g.id)
    setEditingName(g.name)
  }

  function confirmEdit() {
    const name = editingName.trim()
    if (editingId !== null && name) onRename(editingId, name)
    setEditingId(null)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Gruppi</h2>
        <p className="muted" style={{ marginBottom: 12 }}>
          Crea gruppi (es. squadriglie) da assegnare alle attività.
        </p>

        <ul className="project-list" style={{ marginBottom: 16 }}>
          {groups.map((g) => (
            <li key={g.id}>
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
                  <button type="button" onClick={() => startEdit(g)}>
                    Rinomina
                  </button>
                  <button type="button" className="danger" onClick={() => onDelete(g.id)}>
                    Elimina
                  </button>
                </>
              )}
            </li>
          ))}
          {groups.length === 0 && <p className="muted">Nessun gruppo ancora.</p>}
        </ul>

        <form onSubmit={handleCreate} className="location-search-row">
          <input
            placeholder="Nome nuovo gruppo…"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button type="submit" className="primary" disabled={!newName.trim()}>
            Crea
          </button>
        </form>

        <div className="modal-actions">
          <div />
          <div className="modal-actions-primary">
            <button type="button" onClick={onClose}>
              Chiudi
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
