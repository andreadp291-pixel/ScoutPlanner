import type { Group } from '../api/groups'
import type { Person } from '../api/people'
import { parseMaterials, serializeMaterials, type MaterialRow } from '../lib/materials'

// Tabella Cosa / Chi dei materiali di un'attività. Senza onChange è in sola lettura.
export function MaterialsTable({
  value,
  people,
  groups,
  onChange,
}: {
  value: string
  people: Person[]
  groups: Group[]
  onChange?: (text: string) => void
}) {
  const all = parseMaterials(value)
  const rows = onChange ? all : all.filter((r) => r.cosa.trim())
  const names = new Map<string, string>([
    ...people.map((p) => [p.ref, p.name] as [string, string]),
    ...groups.map((g) => [`g${g.id}`, g.name] as [string, string]),
  ])
  const set = (next: MaterialRow[]) => onChange?.(serializeMaterials(next))
  const edit = (i: number, patch: Partial<MaterialRow>) => set(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))

  if (!onChange && rows.length === 0) return <p className="muted">Nessun materiale.</p>

  return (
    <div className="table-scroll">
      <table className="tokens-table" style={{ minWidth: 0 }}>
        <thead>
          <tr>
            <th>Cosa</th>
            <th>Chi</th>
            {onChange && <th aria-label="Azioni" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) =>
            onChange ? (
              <tr key={i}>
                <td>
                  <input
                    aria-label="Cosa"
                    placeholder="Es. corda"
                    value={r.cosa}
                    onChange={(e) => edit(i, { cosa: e.target.value })}
                  />
                </td>
                <td>
                  <select aria-label="Chi" value={r.chi} onChange={(e) => edit(i, { chi: e.target.value })}>
                    <option value="">—</option>
                    {r.chi && !names.has(r.chi) && <option value={r.chi}>(rimosso)</option>}
                    {people.length > 0 && (
                      <optgroup label="Persone">
                        {people.map((p) => (
                          <option key={p.ref} value={p.ref}>{p.name}</option>
                        ))}
                      </optgroup>
                    )}
                    {groups.length > 0 && (
                      <optgroup label="Gruppi">
                        {groups.map((g) => (
                          <option key={g.id} value={`g${g.id}`}>{g.name}</option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </td>
                <td>
                  <button type="button" aria-label="Togli riga" onClick={() => set(rows.filter((_, j) => j !== i))}>
                    ×
                  </button>
                </td>
              </tr>
            ) : (
              <tr key={i}>
                <td>{r.cosa}</td>
                <td>{r.chi ? (names.get(r.chi) ?? '(rimosso)') : '—'}</td>
              </tr>
            ),
          )}
        </tbody>
      </table>
      {onChange && (
        <button type="button" style={{ marginTop: 8 }} onClick={() => set([...rows, { cosa: '', chi: '' }])}>
          + Aggiungi materiale
        </button>
      )}
    </div>
  )
}
