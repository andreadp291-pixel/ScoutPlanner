import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { getNotifications, markNotificationsRead, sendPresence, type NotificationItem } from '../api/live'
import { when } from '../lib/when'

const VERBS: Record<NotificationItem['action'], string> = {
  create: 'ha creato',
  update: 'ha modificato',
  delete: 'ha eliminato',
  restore: 'ha ripristinato',
  purge: 'ha eliminato per sempre',
  comment: 'ha commentato',
  assign: 'ti ha assegnato',
}

const shortName = (name: string) => name.split('@')[0]

// Campanella delle novità del progetto. Interroga il server ogni pochi secondi e, quando qualcuno cambia qualcosa,
// ricarica i dati del progetto: il calendario si aggiorna senza dover ricaricare la pagina.
export function NotificationBell({ projectId }: { projectId: number }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const query = useQuery({
    queryKey: ['notifications', projectId],
    queryFn: () => getNotifications(projectId),
    refetchInterval: 12000,
    refetchIntervalInBackground: false,
  })
  const readMutation = useMutation({
    mutationFn: () => markNotificationsRead(projectId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications', projectId] }),
  })

  const latest = query.data?.latest_id
  const previous = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (latest === undefined) return
    if (previous.current !== undefined && latest !== previous.current) {
      // tutto ciò che riguarda il progetto, tranne le notifiche stesse (già aggiornate) e la presenza
      queryClient.invalidateQueries({
        predicate: (q) => q.queryKey[1] === projectId && q.queryKey[0] !== 'notifications' && q.queryKey[0] !== 'presence',
      })
    }
    previous.current = latest
  }, [latest, projectId, queryClient])

  const unread = query.data?.unread ?? 0
  const link = (n: NotificationItem) =>
    n.action === 'delete' || n.action === 'purge'
      ? null
      : n.entity === 'page'
        ? `/projects/${projectId}/pages/${n.entity_id}`
        : `/projects/${projectId}/activities/${n.entity_id}/description`

  return (
    <div className="bell-wrap">
      <button
        type="button"
        className="bell"
        aria-label={unread ? `Novità: ${unread} da leggere` : 'Novità'}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unread > 0 && <span className="bell-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <>
          <div className="bell-backdrop" onClick={() => setOpen(false)} />
          <div className="bell-pop" role="dialog" aria-label="Novità del progetto">
            <div className="bell-head">
              <strong>Novità</strong>
              <button type="button" className="link" disabled={unread === 0 || readMutation.isPending} onClick={() => readMutation.mutate()}>
                Segna come lette
              </button>
            </div>
            {query.data && query.data.items.length > 0 ? (
              <ul>
                {query.data.items.map((n) => {
                  const to = link(n)
                  const text = (
                    <>
                      <span>
                        <strong>{shortName(n.actor)}</strong> {VERBS[n.action]} <strong>{n.title}</strong>
                      </span>
                      {n.action === 'comment' && n.summary && <span className="muted bell-quote">«{n.summary}»</span>}
                      <span className="muted">{when(n.created_at)}</span>
                    </>
                  )
                  return (
                    <li key={n.id} className={n.unread ? 'unread' : ''}>
                      {to ? (
                        <Link to={to} onClick={() => setOpen(false)}>
                          {text}
                        </Link>
                      ) : (
                        <div>{text}</div>
                      )}
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="muted" style={{ padding: 12 }}>
                Ancora niente di nuovo.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// Chi c'è adesso nel progetto (e cosa sta facendo). Si fa sentire ogni 10 secondi.
export function PresenceBar({ projectId, place, editing }: { projectId: number; place: string; editing: boolean }) {
  const query = useQuery({
    queryKey: ['presence', projectId, place, editing],
    queryFn: () => sendPresence(projectId, place, editing),
    refetchInterval: 10000,
    retry: false,
  })
  const others = query.data ?? []
  if (others.length === 0) return null
  return (
    <div className="presence-bar" aria-live="polite">
      {others.map((o) => (
        <span key={o.ref} className="presence-chip" title={o.place === place ? 'È qui con te' : undefined}>
          <i>{o.name.charAt(0).toUpperCase()}</i>
          {o.name} {o.editing ? 'sta modificando' : 'guarda'}
          {o.place === place && o.place !== 'project' ? ' qui' : ''}
        </span>
      ))}
    </div>
  )
}
