import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { listActivities } from '../../api/activities'
import { listPages } from '../../api/pages'
import type { Block } from './blocks'

// Pulsante che porta a una pagina del progetto ('p<id>') o alla descrizione di un'altra attività ('a<id>').
export function GotoBlockBody({
  block,
  editable,
  projectId,
  onUpdate,
}: {
  block: Extract<Block, { type: 'goto' }>
  editable: boolean
  projectId: number
  onUpdate: (updater: (b: Block) => Block) => void
}) {
  const pages = useQuery({ queryKey: ['pages', projectId], queryFn: () => listPages(projectId) }).data ?? []
  const acts = useQuery({ queryKey: ['activities', projectId], queryFn: () => listActivities(projectId) }).data ?? []

  const kind = block.target[0]
  const tid = Number(block.target.slice(1))
  const page = kind === 'p' ? pages.find((p) => p.id === tid) : undefined
  const act = kind === 'a' ? acts.find((a) => a.id === tid) : undefined
  const name = page?.title ?? act?.title

  if (!editable) {
    if (!name) return <p className="muted">{block.target ? '(pagina eliminata)' : '(nessuna pagina scelta)'}</p>
    const to = page
      ? `/projects/${projectId}/pages/${tid}`
      : `/projects/${projectId}/activities/${tid}/description`
    return (
      <Link to={to} className="btn primary">
        {block.label || name} →
      </Link>
    )
  }

  return (
    <div className="block-link-edit">
      <select
        aria-label="Dove porta"
        value={block.target}
        onChange={(e) => onUpdate((b) => (b.type === 'goto' ? { ...b, target: e.target.value } : b))}
      >
        <option value="">— Scegli dove porta —</option>
        {block.target && !name && <option value={block.target}>(eliminata)</option>}
        {pages.length > 0 && (
          <optgroup label="Pagine">
            {pages.map((p) => (
              <option key={p.id} value={`p${p.id}`}>{p.title}</option>
            ))}
          </optgroup>
        )}
        {acts.length > 0 && (
          <optgroup label="Attività">
            {acts.map((a) => (
              <option key={a.id} value={`a${a.id}`}>
                {a.start_at.slice(5, 10).split('-').reverse().join('/')} {a.start_at.slice(11, 16)} · {a.title}
              </option>
            ))}
          </optgroup>
        )}
      </select>
      <input
        value={block.label}
        placeholder={name ? `Testo del pulsante (vuoto = «${name}»)` : 'Testo del pulsante'}
        onChange={(e) => onUpdate((b) => (b.type === 'goto' ? { ...b, label: e.target.value } : b))}
      />
    </div>
  )
}
