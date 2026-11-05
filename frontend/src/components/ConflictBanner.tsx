// Avviso: mentre scrivevi, qualcun altro ha salvato la stessa cosa.
export function ConflictBanner({ what, onReload }: { what: string; onReload: () => void }) {
  return (
    <div className="share-link-box" role="alert" style={{ marginBottom: 12 }}>
      <p style={{ margin: 0 }}>
        Qualcuno ha modificato {what} mentre scrivevi. Le tue modifiche sono ancora qui: quando salvi ti chiedo se sovrascrivere.
      </p>
      <button type="button" onClick={onReload} style={{ marginTop: 8 }}>
        Ricarica la loro versione (perdo le mie modifiche)
      </button>
    </div>
  )
}
