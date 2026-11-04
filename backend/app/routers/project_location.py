from fastapi import APIRouter, Depends, HTTPException

from ..db import get_conn
from ..deps import Actor, require_project_role
from ..schemas import ProjectLocationIn, ProjectLocationOut

router = APIRouter(prefix="/projects/{project_id}/location", tags=["project_location"])


@router.get("", response_model=ProjectLocationOut)
def get_location(actor: Actor = Depends(require_project_role("viewer"))):
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM project_locations WHERE project_id = ?", (actor.project_id,)
        ).fetchone()
    if row is None:
        raise HTTPException(404, "Posizione non ancora impostata")
    return dict(row)


@router.put("", response_model=ProjectLocationOut)
def set_location(body: ProjectLocationIn, actor: Actor = Depends(require_project_role("editor"))):
    with get_conn() as conn:
        conn.execute(
            """INSERT INTO project_locations (project_id, name, lat, lon, updated_at)
               VALUES (?, ?, ?, ?, datetime('now'))
               ON CONFLICT(project_id) DO UPDATE SET
                 name = excluded.name, lat = excluded.lat, lon = excluded.lon,
                 updated_at = excluded.updated_at""",
            (actor.project_id, body.name, body.lat, body.lon),
        )
        row = conn.execute(
            "SELECT * FROM project_locations WHERE project_id = ?", (actor.project_id,)
        ).fetchone()
    return dict(row)
