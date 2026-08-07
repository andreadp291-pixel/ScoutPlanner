import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { createPage, deletePage, listPages } from '../api/pages'
import { createPoi, deletePoi, listPois, updatePoi, type Poi, type PoiInput, type PoiKind } from '../api/pois'
import { getLocation, setLocation } from '../api/projectLocation'
import { getProjectAccess } from '../api/projects'
import { LocationPickerModal, type PickedLocation } from '../components/editor/LocationPickerModal'
import { ArrowLeftIcon } from '../components/icons/ArrowLeftIcon'
import { LocationIcon } from '../components/icons/LocationIcon'
import { PlusIcon } from '../components/icons/PlusIcon'
import { TrashIcon } from '../components/icons/TrashIcon'
import { PoiFormModal } from '../components/PoiFormModal'
import { PoiMap } from '../components/PoiMap'
import { PoiSearchModal } from '../components/PoiSearchModal'
import { Spinner } from '../components/Spinner'

const KIND_LABELS: Record<PoiKind, string> = {
  hospital: 'Ospedale',
  pharmacy: 'Farmacia',
  fire_station: 'Vigili del fuoco',
  other: 'Altro',
}
const ALL_KINDS = Object.keys(KIND_LABELS) as PoiKind[]

type PoiFormTarget = 'new' | Poi | null

export function ProjectInfo() {
  const { projectId } = useParams()
  const id = Number(projectId)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showLocationPicker, setShowLocationPicker] = useState(false)
  const [poiFormTarget, setPoiFormTarget] = useState<PoiFormTarget>(null)
  const [showPoiSearch, setShowPoiSearch] = useState(false)
  const [visibleKinds, setVisibleKinds] = useState<Set<PoiKind>>(new Set(ALL_KINDS))

  const accessQuery = useQuery({ queryKey: ['access', id], queryFn: () => getProjectAccess(id) })
  const locationQuery = useQuery({ queryKey: ['location', id], queryFn: () => getLocation(id) })
  const poisQuery = useQuery({ queryKey: ['pois', id], queryFn: () => listPois(id) })
  const pagesQuery = useQuery({ queryKey: ['pages', id], queryFn: () => listPages(id) })

  const canEdit = accessQuery.data ? accessQuery.data.role !== 'viewer' : false

  const setLocationMutation = useMutation({
    mutationFn: (picked: PickedLocation) => setLocation(id, picked),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['location', id] })
      setShowLocationPicker(false)
    },
    onError: (err) => alert(err instanceof Error ? err.message : 'Errore durante il salvataggio'),
  })

  const createPoiMutation = useMutation({
    mutationFn: (input: PoiInput) => createPoi(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pois', id] }),
    onError: (err) => alert(err instanceof Error ? err.message : "Errore durante l'aggiunta"),
  })

  const updatePoiMutation = useMutation({
    mutationFn: ({ poiId, input }: { poiId: number; input: PoiInput }) => updatePoi(id, poiId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pois', id] }),
    onError: (err) => alert(err instanceof Error ? err.message : 'Errore durante la modifica'),
  })

  const importPoisMutation = useMutation({
    mutationFn: async (inputs: PoiInput[]) => {
      for (const input of inputs) await createPoi(id, input)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pois', id] })
      setShowPoiSearch(false)
    },
    onError: (err) => alert(err instanceof Error ? err.message : "Errore durante l'importazione"),
  })

  const deletePoiMutation = useMutation({
    mutationFn: (poiId: number) => deletePoi(id, poiId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pois', id] }),
    onError: (err) => alert(err instanceof Error ? err.message : "Errore durante l'eliminazione"),
  })

  const createPageMutation = useMutation({
    mutationFn: (title: string) => createPage(id, { title }),
    onSuccess: (page) => {
      queryClient.invalidateQueries({ queryKey: ['pages', id] })
      navigate(`/projects/${id}/pages/${page.id}`)
    },
    onError: (err) => alert(err instanceof Error ? err.message : 'Errore durante la creazione'),
  })

  const deletePageMutation = useMutation({
    mutationFn: (pageId: number) => deletePage(id, pageId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pages', id] }),
    onError: (err) => alert(err instanceof Error ? err.message : "Errore durante l'eliminazione"),
  })

  function handleNewPage() {
    const title = window.prompt('Titolo della pagina')
    if (title?.trim()) createPageMutation.mutate(title.trim())
  }

  function toggleKind(kind: PoiKind) {
    setVisibleKinds((prev) => {
      const next = new Set(prev)
      if (next.has(kind)) next.delete(kind)
      else next.add(kind)
      return next
    })
  }

  if (accessQuery.isLoading) return <Spinner label="Caricamento..." />

  const location = locationQuery.data
  const pois = poisQuery.data ?? []

  return (
    <div>
      <p>
        <Link to={`/projects/${id}`} className="btn">
          <ArrowLeftIcon />
          Torna al calendario
        </Link>
      </p>
      <h1 style={{ marginBottom: 20 }}>Info generali</h1>

      <div className="card">
        <h2>Posizione del campo</h2>
        {location ? (
          <p>
            <LocationIcon size={16} /> {location.name}
          </p>
        ) : (
          <p className="muted">Nessuna posizione impostata.</p>
        )}
        {canEdit && (
          <button type="button" onClick={() => setShowLocationPicker(true)}>
            {location ? 'Modifica posizione' : 'Imposta posizione'}
          </button>
        )}
      </div>

      <div className="card">
        <h2>Punti di interesse</h2>

        {(pois.length > 0 || location) && (
          <>
            <div className="poi-filter-row">
              {ALL_KINDS.map((kind) => (
                <label key={kind} className="group-checkbox-item">
                  <input
                    type="checkbox"
                    checked={visibleKinds.has(kind)}
                    onChange={() => toggleKind(kind)}
                  />
                  {KIND_LABELS[kind]}
                </label>
              ))}
            </div>
            <PoiMap campLocation={location ?? null} pois={pois} visibleKinds={visibleKinds} />
          </>
        )}

        {pois.length > 0 ? (
          <ul className="poi-list">
            {pois
              .filter((poi) => visibleKinds.has(poi.kind))
              .map((poi) => (
                <li key={poi.id} className="poi-card">
                  <div>
                    <span className="poi-kind-badge">{KIND_LABELS[poi.kind]}</span>
                    <strong>{poi.name}</strong>
                    {poi.phone && (
                      <>
                        {' · '}
                        <a href={`tel:${poi.phone.replace(/\s+/g, '')}`}>{poi.phone}</a>
                      </>
                    )}
                    {poi.address && <div className="muted">{poi.address}</div>}
                    {poi.hours && <div className="muted">Orari: {poi.hours}</div>}
                    {poi.notes && <div className="muted">{poi.notes}</div>}
                  </div>
                  {canEdit && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button type="button" onClick={() => setPoiFormTarget(poi)}>
                        Modifica
                      </button>
                      <button
                        type="button"
                        aria-label="Elimina"
                        onClick={() => deletePoiMutation.mutate(poi.id)}
                      >
                        <TrashIcon size={14} />
                      </button>
                    </div>
                  )}
                </li>
              ))}
          </ul>
        ) : (
          <p className="muted">Nessun punto di interesse ancora.</p>
        )}
        {canEdit && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            <button type="button" onClick={() => setPoiFormTarget('new')}>
              <PlusIcon size={14} /> Aggiungi manualmente
            </button>
            <button type="button" onClick={() => setShowPoiSearch(true)} disabled={!location}>
              Cerca vicino al campo
            </button>
          </div>
        )}
      </div>

      <div className="card">
        <h2>Pagine</h2>
        {pagesQuery.data && pagesQuery.data.length > 0 ? (
          <ul className="project-list">
            {pagesQuery.data.map((page) => (
              <li key={page.id}>
                <Link to={`/projects/${id}/pages/${page.id}`}>{page.title}</Link>
                {canEdit && (
                  <button
                    type="button"
                    aria-label="Elimina pagina"
                    onClick={() => {
                      if (window.confirm(`Eliminare la pagina "${page.title}"?`)) deletePageMutation.mutate(page.id)
                    }}
                  >
                    <TrashIcon size={14} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Nessuna pagina ancora.</p>
        )}
        {canEdit && (
          <button type="button" onClick={handleNewPage} style={{ marginTop: 8 }}>
            <PlusIcon size={14} /> Nuova pagina
          </button>
        )}
      </div>

      {showLocationPicker && (
        <LocationPickerModal
          onConfirm={(picked) => setLocationMutation.mutate(picked)}
          onClose={() => setShowLocationPicker(false)}
        />
      )}
      {poiFormTarget && (
        <PoiFormModal
          initial={poiFormTarget === 'new' ? undefined : poiFormTarget}
          onSave={(input) => {
            if (poiFormTarget === 'new') createPoiMutation.mutate(input)
            else updatePoiMutation.mutate({ poiId: poiFormTarget.id, input })
            setPoiFormTarget(null)
          }}
          onClose={() => setPoiFormTarget(null)}
        />
      )}
      {showPoiSearch && location && (
        <PoiSearchModal
          campLocation={{ lat: location.lat, lon: location.lon }}
          onImport={(pois) => importPoisMutation.mutate(pois)}
          onClose={() => setShowPoiSearch(false)}
        />
      )}
    </div>
  )
}
