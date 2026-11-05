import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getEmailPrefs, setEmailPrefs, type EmailPrefs as Prefs } from '../api/emailPrefs'
import { Spinner } from '../components/Spinner'

// Cosa ricevere per email: avvisi quando succede qualcosa, e il report della mattina.
export function EmailPrefs() {
  const queryClient = useQueryClient()
  const prefsQuery = useQuery({ queryKey: ['email-prefs'], queryFn: getEmailPrefs })
  const mutation = useMutation({
    mutationFn: (p: Prefs) => setEmailPrefs(p),
    onSuccess: (p) => queryClient.setQueryData(['email-prefs'], p),
    onError: (err) => alert(err instanceof Error ? err.message : 'Errore durante il salvataggio'),
  })

  if (prefsQuery.isLoading) return <Spinner label="Caricamento..." />
  if (!prefsQuery.data) return <p role="alert">Preferenze non disponibili: accedi con il tuo account.</p>
  const prefs = prefsQuery.data

  return (
    <div>
      <h1>Notifiche email</h1>
      <div className="card">
        <label className="group-checkbox-item">
          <input
            type="checkbox"
            checked={prefs.notifications}
            disabled={mutation.isPending}
            onChange={(e) => mutation.mutate({ ...prefs, notifications: e.target.checked })}
          />
          <span>
            <strong>Avvisi</strong> — quando mi assegnano un'attività, cambia un'attività che seguo o qualcuno commenta.
          </span>
        </label>
        <label className="group-checkbox-item" style={{ marginTop: 12 }}>
          <input
            type="checkbox"
            checked={prefs.report}
            disabled={mutation.isPending}
            onChange={(e) => mutation.mutate({ ...prefs, report: e.target.checked })}
          />
          <span>
            <strong>Promemoria</strong> — «ti mancano da compilare…» per le attività assegnate a me, prima del campo. Durante il campo non arriva niente di automatico.
          </span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
          <span>Mandameli alle</span>
          <select
            value={prefs.reminder_hour}
            disabled={mutation.isPending || !prefs.report}
            onChange={(e) => mutation.mutate({ ...prefs, reminder_hour: Number(e.target.value) })}
            aria-label="Ora del promemoria"
          >
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, '0')}:00
              </option>
            ))}
          </select>
          <span className="muted">(ora italiana, al massimo uno ogni 3 giorni)</span>
        </label>
      </div>
    </div>
  )
}
