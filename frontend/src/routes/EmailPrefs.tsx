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
            <strong>Report del mattino</strong> — ogni giorno alle 7, durante il campo: le mie attività fatte, da fare e in ritardo.
          </span>
        </label>
      </div>
    </div>
  )
}
