from fastapi import APIRouter, Depends

from ..db import get_conn
from ..deps import Actor, require_project_role
from ..schemas import ActivityCreateIn, ActivityOut, ActivityUpdateIn

router = APIRouter(prefix="/projects/{project_id}/activities", tags=["activities"])


@router.get("", response_model=list[ActivityOut])
async def list_activities(actor: Actor = Depends(require_project_role("viewer"))):
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM activities WHERE project_id = ? ORDER BY start_at", (actor.project_id,)
        ).fetchall()
    return [dict(r) for r in rows]


@router.post("", response_model=ActivityOut, status_code=201)
async def create_activity(body: ActivityCreateIn, actor: Actor = Depends(require_project_role("editor"))):
    with get_conn() as conn:
        cur = conn.execute(
            """INSERT INTO activities
               (project_id, title, description, location, category, color, start_at, end_at, created_by)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                actor.project_id, body.title, body.description, body.location,
                body.category, body.color, body.start_at, body.end_at, actor.name,
            ),
        )
        activity_id = cur.lastrowid
        row = conn.execute("SELECT * FROM activities WHERE id = ?", (activity_id,)).fetchone()
    return dict(row)


@router.patch("/{activity_id}", response_model=ActivityOut)
async def update_activity(
    activity_id: int, body: ActivityUpdateIn, actor: Actor = Depends(require_project_role("editor"))
):
    fields = body.model_dump(exclude_unset=True)
    with get_conn() as conn:
        if fields:
            set_parts = [f"{k} = ?" for k in fields] + ["updated_at = datetime('now')"]
            values = [*fields.values(), activity_id, actor.project_id]
            conn.execute(
                f"UPDATE activities SET {', '.join(set_parts)} WHERE id = ? AND project_id = ?",
                values,
            )
        row = conn.execute(
            "SELECT * FROM activities WHERE id = ? AND project_id = ?", (activity_id, actor.project_id)
        ).fetchone()
    return dict(row)


@router.delete("/{activity_id}", status_code=204)
async def delete_activity(activity_id: int, actor: Actor = Depends(require_project_role("editor"))):
    with get_conn() as conn:
        conn.execute(
            "DELETE FROM activities WHERE id = ? AND project_id = ?", (activity_id, actor.project_id)
        )
