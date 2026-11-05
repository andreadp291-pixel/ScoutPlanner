import { useEffect, useState } from 'react'

// Tiene a mente la versione del server su cui sto scrivendo. Finché non ho modifiche in sospeso segue il server
// (le novità degli altri compaiono da sole); appena scrivo, si ferma: se il server cambia, c'è un conflitto.
export function useEditBase(serverAt: string | undefined, dirty: boolean) {
  const [base, setBase] = useState<string | null>(null)
  useEffect(() => {
    if (!dirty && serverAt) setBase(serverAt)
  }, [dirty, serverAt])
  const conflict = dirty && base !== null && serverAt !== undefined && serverAt !== base
  return { base, setBase, conflict }
}

export const isConflict = (err: unknown) => err instanceof Error && err.message.startsWith('Modifica in conflitto')
