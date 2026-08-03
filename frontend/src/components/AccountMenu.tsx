import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

interface AccountMenuProps {
  label: string // email o nome visualizzato
  initial: string // lettera per l'icona
  items: { to: string; label: string }[]
  onLogout: () => void
}

export function AccountMenu({ label, initial, items, onLogout }: AccountMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleLogout() {
    setOpen(false)
    onLogout()
    navigate('/', { replace: true })
  }

  return (
    <div className="account-menu" ref={ref}>
      <button
        type="button"
        className="account-menu-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        {initial}
      </button>
      {open && (
        <div className="account-menu-dropdown">
          <div className="account-menu-label">{label}</div>
          <div className="account-menu-divider" />
          {items.map((item) => (
            <Link key={item.to} to={item.to} className="account-menu-item" onClick={() => setOpen(false)}>
              {item.label}
            </Link>
          ))}
          <div className="account-menu-divider" />
          <button type="button" className="account-menu-item danger" onClick={handleLogout}>
            Esci
          </button>
        </div>
      )}
    </div>
  )
}
