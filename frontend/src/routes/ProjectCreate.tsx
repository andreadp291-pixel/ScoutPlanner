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
      <form onSubmit={handleSubmit}>
        <label>
          Nome (es. "Campo estivo 2026")
          <input required value={name} onChange={(e) => setName(e.target.value)} />
        </label>
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
        <button type="submit">Crea progetto</button>
      </form>
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
