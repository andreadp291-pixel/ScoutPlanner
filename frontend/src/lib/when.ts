// il server dà l'ora UTC senza fuso: "2026-07-01 09:00:00"
export const when = (s: string) =>
  new Date(s.replace(' ', 'T') + 'Z').toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
