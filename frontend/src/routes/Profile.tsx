import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getProfile, setProfile } from '../api/me'
import { Spinner } from '../components/Spinner'
import { useAuthStore } from '../state/authStore'
import { useMemberAuthStore } from '../state/memberAuthStore'

// Il mio profilo: nome con cui compaio nei progetti, più i collegamenti alle altre impostazioni dell'account.
export function Profile() {
  const queryClient = useQueryClient()
  const isOwner = useAuthStore((s) => s.email) !== null
  const member = useMemberAuthStore()
  const [name, setName] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const profileQuery = useQuery({ queryKey: ['profile'], queryFn: getProfile })
  const mutation = useMutation({
    mutationFn: (n: string) => setProfile(n),
    onSuccess: (p) => {
      queryClient.setQueryData(['profile'], p)
      queryClient.invalidateQueries({ queryKey: ['people'] })
      if (!isOwner && member.sessionToken) member.setSession(member.sessionToken, p.name, member.mustChangePassword)
      setName(null)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
    onError: (err) => alert(err instanceof Error ? err.message : 'Errore durante il salvataggio'),
  })

  if (profileQuery.isLoading) return <Spinner label="Caricamento..." />
  if (!profileQuery.data) return <p role="alert">Profilo non disponibile: accedi con il tuo account.</p>
  const current = name ?? profileQuery.data.name

  return (
    <div>
      <h1>Profilo</h1>
      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault()
          if (current.trim()) mutation.mutate(current.trim())
        }}
      >
        <label>
          Nome
          <input value={current} maxLength={100} onChange={(e) => setName(e.target.value)} />
        </label>
        <p className="muted" style={{ margin: '4px 0 12px' }}>
          È il nome che gli altri vedono nelle attività, nei materiali e nei commenti.
        </p>
        <label>
          Email
          <input value={profileQuery.data.email} disabled />
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
          <button type="submit" className="primary" disabled={mutation.isPending || name === null || !current.trim()}>
            {mutation.isPending ? 'Salvataggio...' : 'Salva'}
          </button>
          {saved && <span className="muted">Salvato ✓</span>}
        </div>
      </form>

      <div className="card" style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link to="/account/email" className="btn">Notifiche email</Link>
        <Link to={isOwner ? '/owner/set-password' : '/member/change-password'} className="btn">
          {isOwner ? 'Imposta password' : 'Cambia password'}
        </Link>
      </div>
    </div>
  )
}
