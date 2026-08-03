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
      <Link to="/projects/new">+ Nuovo progetto</Link>
      <ul>
        {data?.map((p) => (
          <li key={p.id}>
            <Link to={`/projects/${p.id}`}>
              {p.name} ({p.start_date} → {p.end_date})
            </Link>
          </li>
        ))}
      </ul>
      {data?.length === 0 && <p>Nessun progetto ancora. Creane uno per iniziare.</p>}
    </div>
  )
}
