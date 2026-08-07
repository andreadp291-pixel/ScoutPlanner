import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createProject } from '../api/projects'

export function ProjectCreate() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      const project = await createProject({ name, start_date: startDate, end_date: endDate })
      navigate(`/projects/${project.id}`, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore imprevisto')
    }
  }

  return (
    <div>
      <h1>Nuovo progetto</h1>
      <form className="card" onSubmit={handleSubmit} style={{ maxWidth: 420 }}>
        <label>
          Nome (es. "Campo estivo 2026")
          <input required value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="form-row">
          <label>
            Data inizio
            <input
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </label>
          <label>
            Data fine
            <input type="date" required value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
        </div>
        <button type="submit" className="primary">
          Crea progetto
        </button>
        {error && (
          <p role="alert" style={{ color: 'var(--danger)', marginTop: 10 }}>
            {error}
          </p>
        )}
      </form>
    </div>
  )
}
