import { useRef, useState } from 'react'
import { uploadFile } from '../../api/uploads'
import { ChevronDownIcon } from '../icons/ChevronDownIcon'
import { ChevronUpIcon } from '../icons/ChevronUpIcon'
import { ImageIcon } from '../icons/ImageIcon'
import { LocationIcon } from '../icons/LocationIcon'
import { PlusIcon } from '../icons/PlusIcon'
import { TrashIcon } from '../icons/TrashIcon'
import { AddBlockSheet } from './AddBlockSheet'
import type { ActivityDoc, Block, BlockType } from './blocks'
import { emptyBlock } from './blocks'
import { LocationPickerModal, type PickedLocation } from './LocationPickerModal'

interface BlockEditorProps {
  projectId: number
  content: ActivityDoc | null
  editable: boolean
  onChange?: (doc: ActivityDoc) => void
}

function isSafeUrl(url: string): boolean {
  return /^(https?:|mailto:|tel:|\/|#)/i.test(url.trim())
}

export function BlockEditor({ projectId, content, editable, onChange }: BlockEditorProps) {
  const [blocks, setBlocks] = useState<Block[]>(content?.blocks ?? [])
  const [showAdd, setShowAdd] = useState(false)
  const [locationEditingId, setLocationEditingId] = useState<string | null>(null)

  function emitChange(next: Block[]) {
    setBlocks(next)
    onChange?.({ blocks: next })
  }

  function updateBlock(id: string, updater: (b: Block) => Block) {
    emitChange(blocks.map((b) => (b.id === id ? updater(b) : b)))
  }

  function removeBlock(id: string) {
    emitChange(blocks.filter((b) => b.id !== id))
  }

  function moveBlock(id: string, dir: -1 | 1) {
    const idx = blocks.findIndex((b) => b.id === id)
    const newIdx = idx + dir
    if (newIdx < 0 || newIdx >= blocks.length) return
    const next = [...blocks]
    const [moved] = next.splice(idx, 1)
    next.splice(newIdx, 0, moved)
    emitChange(next)
  }

  function addBlock(type: BlockType) {
    emitChange([...blocks, emptyBlock(type)])
    setShowAdd(false)
  }

  if (!editable && blocks.length === 0) {
    return <p className="muted">Nessuna descrizione ancora.</p>
  }

  return (
    <div className="block-editor">
      {blocks.map((block, idx) => (
        <div key={block.id} className={editable ? 'block-card' : 'block-card block-card-readonly'}>
          {editable && (
            <div className="block-toolbar">
              <button
                type="button"
                onClick={() => moveBlock(block.id, -1)}
                disabled={idx === 0}
                aria-label="Sposta su"
                title="Sposta su"
              >
                <ChevronUpIcon size={14} />
              </button>
              <button
                type="button"
                onClick={() => moveBlock(block.id, 1)}
                disabled={idx === blocks.length - 1}
                aria-label="Sposta giù"
                title="Sposta giù"
              >
                <ChevronDownIcon size={14} />
              </button>
              <span className="block-toolbar-spacer" />
              <button
                type="button"
                className="danger"
                onClick={() => removeBlock(block.id)}
                aria-label="Elimina blocco"
                title="Elimina blocco"
              >
                <TrashIcon size={14} />
              </button>
            </div>
          )}

          <BlockBody
            block={block}
            editable={editable}
            projectId={projectId}
            onUpdate={(updater) => updateBlock(block.id, updater)}
            onPickLocation={() => setLocationEditingId(block.id)}
          />
        </div>
      ))}

      {editable && (
        <button type="button" className="block-add-btn" onClick={() => setShowAdd(true)}>
          <PlusIcon size={16} /> Aggiungi
        </button>
      )}

      {editable && !blocks.length && <p className="muted">Premi "Aggiungi" per iniziare a descrivere l'attività.</p>}

      {showAdd && <AddBlockSheet onPick={addBlock} onClose={() => setShowAdd(false)} />}

      {locationEditingId && (
        <LocationPickerModal
          onClose={() => setLocationEditingId(null)}
          onConfirm={(picked: PickedLocation) => {
            updateBlock(locationEditingId, (b) =>
              b.type === 'location' ? { ...b, name: picked.name, lat: picked.lat, lon: picked.lon } : b,
            )
            setLocationEditingId(null)
          }}
        />
      )}
    </div>
  )
}

interface BlockBodyProps {
  block: Block
  editable: boolean
  projectId: number
  onUpdate: (updater: (b: Block) => Block) => void
  onPickLocation: () => void
}

function BlockBody({ block, editable, projectId, onUpdate, onPickLocation }: BlockBodyProps) {
  switch (block.type) {
    case 'title':
      return editable ? (
        <input
          className="block-title-input"
          value={block.text}
          placeholder="Titolo…"
          onChange={(e) => onUpdate((b) => (b.type === 'title' ? { ...b, text: e.target.value } : b))}
        />
      ) : (
        <h2 className="block-title-view">{block.text || <span className="muted">(titolo vuoto)</span>}</h2>
      )

    case 'text':
      return editable ? (
        <textarea
          className="block-text-input"
          value={block.text}
          placeholder="Scrivi qui…"
          rows={4}
          onChange={(e) => onUpdate((b) => (b.type === 'text' ? { ...b, text: e.target.value } : b))}
        />
      ) : (
        <p className="block-text-view">{block.text || <span className="muted">(vuoto)</span>}</p>
      )

    case 'list':
      return <ListBlockBody block={block} editable={editable} onUpdate={onUpdate} />

    case 'image':
      return <ImageBlockBody block={block} editable={editable} projectId={projectId} onUpdate={onUpdate} />

    case 'link':
      return <LinkBlockBody block={block} editable={editable} onUpdate={onUpdate} />

    case 'phone':
      return editable ? (
        <input
          className="block-phone-input"
          type="tel"
          value={block.number}
          placeholder="Numero di telefono"
          onChange={(e) => onUpdate((b) => (b.type === 'phone' ? { ...b, number: e.target.value } : b))}
        />
      ) : block.number ? (
        <a href={`tel:${block.number.replace(/\s+/g, '')}`} className="block-phone-view">
          {block.number}
        </a>
      ) : (
        <p className="muted">(nessun numero)</p>
      )

    case 'location':
      return (
        <div className="block-location">
          {block.name ? (
            <a
              href={`https://www.openstreetmap.org/?mlat=${block.lat}&mlon=${block.lon}#map=16/${block.lat}/${block.lon}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block-location-link"
            >
              <LocationIcon size={16} /> {block.name}
            </a>
          ) : (
            <p className="muted">(nessuna posizione scelta)</p>
          )}
          {editable && (
            <button type="button" onClick={onPickLocation}>
              <LocationIcon size={14} /> {block.name ? 'Cambia posizione' : 'Scegli posizione'}
            </button>
          )}
        </div>
      )

    case 'table':
      return <TableBlockBody block={block} editable={editable} onUpdate={onUpdate} />

    case 'divider':
      return <hr className="block-divider" />
  }
}

function ListBlockBody({
  block,
  editable,
  onUpdate,
}: {
  block: Extract<Block, { type: 'list' }>
  editable: boolean
  onUpdate: (updater: (b: Block) => Block) => void
}) {
  function setItems(items: string[]) {
    onUpdate((b) => (b.type === 'list' ? { ...b, items } : b))
  }

  if (!editable) {
    const items = block.items.filter((i) => i.trim())
    return items.length ? (
      <ul className="block-list-view">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    ) : (
      <p className="muted">(elenco vuoto)</p>
    )
  }

  return (
    <div className="block-list-edit">
      {block.items.map((item, i) => (
        <div className="block-list-row" key={i}>
          <input
            value={item}
            placeholder="Voce…"
            onChange={(e) => {
              const next = [...block.items]
              next[i] = e.target.value
              setItems(next)
            }}
          />
          <button
            type="button"
            aria-label="Rimuovi voce"
            onClick={() => setItems(block.items.filter((_, j) => j !== i))}
            disabled={block.items.length === 1}
          >
            <TrashIcon size={14} />
          </button>
        </div>
      ))}
      <button type="button" onClick={() => setItems([...block.items, ''])}>
        <PlusIcon size={14} /> Aggiungi voce
      </button>
    </div>
  )
}

function ImageBlockBody({
  block,
  editable,
  projectId,
  onUpdate,
}: {
  block: Extract<Block, { type: 'image' }>
  editable: boolean
  projectId: number
  onUpdate: (updater: (b: Block) => Block) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    try {
      const result = await uploadFile(projectId, file)
      onUpdate((b) => (b.type === 'image' ? { ...b, url: result.url, filename: result.filename } : b))
    } catch (err) {
      alert(err instanceof Error ? err.message : "Errore durante il caricamento dell'immagine")
    } finally {
      setUploading(false)
    }
  }

  if (!editable) {
    return block.url ? (
      <img src={block.url} alt={block.filename} className="block-image-view" />
    ) : (
      <p className="muted">(nessuna foto)</p>
    )
  }

  return (
    <div className="block-image-edit">
      {block.url && <img src={block.url} alt={block.filename} className="block-image-view" />}
      <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
      <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}>
        <ImageIcon size={14} /> {uploading ? 'Caricamento…' : block.url ? 'Sostituisci foto' : 'Carica foto'}
      </button>
    </div>
  )
}

function LinkBlockBody({
  block,
  editable,
  onUpdate,
}: {
  block: Extract<Block, { type: 'link' }>
  editable: boolean
  onUpdate: (updater: (b: Block) => Block) => void
}) {
  if (!editable) {
    if (!block.url) return <p className="muted">(nessun link)</p>
    return isSafeUrl(block.url) ? (
      <a href={block.url} target="_blank" rel="noopener noreferrer" className="block-link-view">
        {block.label || block.url}
      </a>
    ) : (
      <p className="muted">Link non valido</p>
    )
  }

  return (
    <div className="block-link-edit">
      <input
        value={block.label}
        placeholder="Testo del link (es. Modulo iscrizione)"
        onChange={(e) => onUpdate((b) => (b.type === 'link' ? { ...b, label: e.target.value } : b))}
      />
      <input
        value={block.url}
        placeholder="https://…"
        onChange={(e) => onUpdate((b) => (b.type === 'link' ? { ...b, url: e.target.value } : b))}
      />
    </div>
  )
}

function TableBlockBody({
  block,
  editable,
  onUpdate,
}: {
  block: Extract<Block, { type: 'table' }>
  editable: boolean
  onUpdate: (updater: (b: Block) => Block) => void
}) {
  function setRows(rows: string[][]) {
    onUpdate((b) => (b.type === 'table' ? { ...b, rows } : b))
  }

  const cols = block.rows[0]?.length ?? 0

  function addRow() {
    setRows([...block.rows, Array.from({ length: cols }, () => '')])
  }
  function addCol() {
    setRows(block.rows.map((row) => [...row, '']))
  }
  function removeRow(i: number) {
    if (block.rows.length <= 1) return
    setRows(block.rows.filter((_, j) => j !== i))
  }
  function removeCol(i: number) {
    if (cols <= 1) return
    setRows(block.rows.map((row) => row.filter((_, j) => j !== i)))
  }

  if (!editable) {
    return (
      <div className="table-scroll">
        <table className="block-table-view">
          <tbody>
            {block.rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="block-table-edit">
      <div className="table-scroll">
        <table>
          <tbody>
            {block.rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j}>
                    <input
                      value={cell}
                      onChange={(e) => {
                        const next = block.rows.map((r) => [...r])
                        next[i][j] = e.target.value
                        setRows(next)
                      }}
                    />
                  </td>
                ))}
                <td className="block-table-row-actions">
                  <button type="button" aria-label="Rimuovi riga" onClick={() => removeRow(i)}>
                    <TrashIcon size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="block-table-controls">
        <button type="button" onClick={addRow}>
          <PlusIcon size={13} /> Riga
        </button>
        <button type="button" onClick={addCol}>
          <PlusIcon size={13} /> Colonna
        </button>
        <button type="button" onClick={() => removeCol(cols - 1)} disabled={cols <= 1}>
          <TrashIcon size={13} /> Colonna
        </button>
      </div>
    </div>
  )
}
