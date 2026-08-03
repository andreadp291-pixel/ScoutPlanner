import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { listProjects } from '../api/projects'

export function ProjectList() {
  const { data, isLoading, error } = useQuery({ queryKey: ['projects'], queryFn: listProjects })

  if (isLoading) return <p>Caricamento progetti...</p>
  if (error) return <p role="alert">Errore nel caricamento dei progetti</p>

  return (
    <div>
      <h1>I tuoi progetti</h1>
      <Link to="/projects/new">
        <button type="button" className="primary">
          + Nuovo progetto
        </button>
      </Link>
      <ul className="project-list">
        {data?.map((p) => (
          <li key={p.id}>
            <Link to={`/projects/${p.id}`}>
              {p.name}
              <div className="dates">
                {p.start_date} → {p.end_date}
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {data?.length === 0 && <p className="muted">Nessun progetto ancora. Creane uno per iniziare.</p>}
    </div>
  )
}
