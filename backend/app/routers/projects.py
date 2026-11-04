import os
import shutil

from fastapi import APIRouter, Depends, HTTPException

from ..config import UPLOADS_DIR
from ..db import get_conn
from ..deps import Actor, require_owner_session, require_project_role
from ..schemas import ProjectCreateIn, ProjectOut, ProjectUpdateIn

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=list[ProjectOut])
def list_projects(email: str = Depends(require_owner_session)):
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM projects WHERE owner_email = ? ORDER BY start_date", (email,)
        ).fetchall()
    return [dict(r) for r in rows]


@router.post("", response_model=ProjectOut, status_code=201)
def create_project(body: ProjectCreateIn, email: str = Depends(require_owner_session)):
    if body.end_date < body.start_date:
        raise HTTPException(status_code=400, detail="La data di fine precede quella di inizio")
    with get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO projects (name, owner_email, start_date, end_date) VALUES (?, ?, ?, ?)",
            (body.name, email, body.start_date, body.end_date),
        )
        project_id = cur.lastrowid
        row = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    return dict(row)


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(actor: Actor = Depends(require_project_role("viewer"))):
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM projects WHERE id = ?", (actor.project_id,)).fetchone()
    return dict(row)


@router.get("/{project_id}/access")
def get_access(actor: Actor = Depends(require_project_role("viewer"))):
    return {"role": actor.role, "name": actor.name}


@router.patch("/{project_id}", response_model=ProjectOut)
def update_project(body: ProjectUpdateIn, actor: Actor = Depends(require_project_role("owner"))):
    fields = body.model_dump(exclude_unset=True)
    if any(v is None for v in fields.values()):
        raise HTTPException(status_code=400, detail="Campi non possono essere null")
    if fields:
        with get_conn() as conn:
            current = conn.execute("SELECT start_date, end_date FROM projects WHERE id = ?", (actor.project_id,)).fetchone()
            if fields.get("end_date", current["end_date"]) < fields.get("start_date", current["start_date"]):
                raise HTTPException(status_code=400, detail="La data di fine precede quella di inizio")
            set_clause = ", ".join(f"{k} = ?" for k in fields)
            conn.execute(
                f"UPDATE projects SET {set_clause} WHERE id = ?",
                (*fields.values(), actor.project_id),
            )
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM projects WHERE id = ?", (actor.project_id,)).fetchone()
    return dict(row)


@router.delete("/{project_id}", status_code=204)
def delete_project(actor: Actor = Depends(require_project_role("owner"))):
    with get_conn() as conn:
        conn.execute("DELETE FROM projects WHERE id = ?", (actor.project_id,))
    shutil.rmtree(os.path.join(UPLOADS_DIR, str(actor.project_id)), ignore_errors=True)
