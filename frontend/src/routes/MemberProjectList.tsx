import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getMyProjects } from '../api/me'
import { formatShortDate } from '../components/calendar/time'
import { Spinner } from '../components/Spinner'

export function MemberProjectList() {
  const { data, isLoading, error } = useQuery({ queryKey: ['my-projects'], queryFn: getMyProjects })

  if (isLoading) return <Spinner label="Caricamento progetti..." />
  if (error) return <p role="alert">Errore nel caricamento dei progetti</p>

  return (
    <div>
      <h1>Progetti a cui collabori</h1>
      <ul className="project-list">
        {data?.map((p) => (
          <li key={p.id}>
            <Link to={`/projects/${p.id}`}>
              {p.name}
              <div className="dates">
                {formatShortDate(p.start_date)} → {formatShortDate(p.end_date)} ·{' '}
                {p.role === 'editor' ? 'Editor' : 'Sola lettura'}
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {data?.length === 0 && <p className="muted">Non fai ancora parte di nessun progetto.</p>}
    </div>
  )
}
