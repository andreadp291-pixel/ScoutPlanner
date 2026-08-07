import type { BlockType } from './blocks'
import { CompassIcon } from '../icons/CompassIcon'
import { DividerIcon } from '../icons/DividerIcon'
import { FileTextIcon } from '../icons/FileTextIcon'
import { ImageIcon } from '../icons/ImageIcon'
import { LinkIcon } from '../icons/LinkIcon'
import { ListIcon } from '../icons/ListIcon'
import { LocationIcon } from '../icons/LocationIcon'
import { PhoneIcon } from '../icons/PhoneIcon'
import { TableIcon } from '../icons/TableIcon'
import { TitleIcon } from '../icons/TitleIcon'

interface AddBlockSheetProps {
  onPick: (type: BlockType) => void
  onClose: () => void
}

const OPTIONS: { type: BlockType; label: string; icon: React.ReactNode }[] = [
  { type: 'title', label: 'Titolo', icon: <TitleIcon size={22} /> },
  { type: 'text', label: 'Testo', icon: <FileTextIcon size={22} /> },
  { type: 'list', label: 'Elenco', icon: <ListIcon size={22} /> },
  { type: 'image', label: 'Foto', icon: <ImageIcon size={22} /> },
  { type: 'link', label: 'Link', icon: <LinkIcon size={22} /> },
  { type: 'phone', label: 'Telefono', icon: <PhoneIcon size={22} /> },
  { type: 'location', label: 'Posizione', icon: <LocationIcon size={22} /> },
  { type: 'table', label: 'Tabella', icon: <TableIcon size={22} /> },
  { type: 'gpx', label: 'Traccia GPX', icon: <CompassIcon size={22} /> },
  { type: 'divider', label: 'Divisore', icon: <DividerIcon size={22} /> },
]

export function AddBlockSheet({ onPick, onClose }: AddBlockSheetProps) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal add-block-sheet" onClick={(e) => e.stopPropagation()}>
        <h2>Cosa vuoi aggiungere?</h2>
        <div className="add-block-grid">
          {OPTIONS.map((opt) => (
            <button key={opt.type} type="button" className="add-block-option" onClick={() => onPick(opt.type)}>
              {opt.icon}
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
        <div className="modal-actions">
          <div />
          <div className="modal-actions-primary">
            <button type="button" onClick={onClose}>
              Annulla
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
