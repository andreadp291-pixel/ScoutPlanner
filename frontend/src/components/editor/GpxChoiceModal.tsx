import { CompassIcon } from '../icons/CompassIcon'
import { UploadIcon } from '../icons/UploadIcon'

interface GpxChoiceModalProps {
  onUpload: () => void
  onClose: () => void
}

export function GpxChoiceModal({ onUpload, onClose }: GpxChoiceModalProps) {
  function handleCreate() {
    window.open('https://gpx.studio/', '_blank', 'noopener,noreferrer')
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Traccia GPX</h2>
        <p className="muted" style={{ marginBottom: 16 }}>
          Carica un file GPX già pronto, oppure disegna un percorso su gpx.studio e poi caricalo qui.
        </p>
        <div className="gpx-choice-row">
          <button type="button" className="primary" onClick={onUpload}>
            <UploadIcon /> Carica file GPX
          </button>
          <button type="button" onClick={handleCreate}>
            <CompassIcon /> Crea con gpx.studio
          </button>
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
