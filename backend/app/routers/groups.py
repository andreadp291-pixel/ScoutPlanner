from fastapi import APIRouter, Depends, HTTPException

from ..db import get_conn
from ..deps import Actor, require_project_role
from ..schemas import GroupCreateIn, GroupOut

router = APIRouter(prefix="/projects/{project_id}/groups", tags=["groups"])


@router.get("", response_model=list[GroupOut])
async def list_groups(actor: Actor = Depends(require_project_role("viewer"))):
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM groups WHERE project_id = ? ORDER BY name", (actor.project_id,)
        ).fetchall()
    return [dict(r) for r in rows]


@router.post("", response_model=GroupOut, status_code=201)
async def create_group(body: GroupCreateIn, actor: Actor = Depends(require_project_role("editor"))):
    with get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO groups (project_id, name) VALUES (?, ?)", (actor.project_id, body.name)
        )
        row = conn.execute("SELECT * FROM groups WHERE id = ?", (cur.lastrowid,)).fetchone()
    return dict(row)


@router.patch("/{group_id}", response_model=GroupOut)
async def rename_group(
    group_id: int, body: GroupCreateIn, actor: Actor = Depends(require_project_role("editor"))
):
    with get_conn() as conn:
        current = conn.execute(
            "SELECT * FROM groups WHERE id = ? AND project_id = ?", (group_id, actor.project_id)
        ).fetchone()
        if not current:
            raise HTTPException(404, "Gruppo non trovato")
        conn.execute("UPDATE groups SET name = ? WHERE id = ?", (body.name, group_id))
        row = conn.execute("SELECT * FROM groups WHERE id = ?", (group_id,)).fetchone()
    return dict(row)


@router.delete("/{group_id}", status_code=204)
async def delete_group(group_id: int, actor: Actor = Depends(require_project_role("editor"))):
    with get_conn() as conn:
        conn.execute("DELETE FROM groups WHERE id = ? AND project_id = ?", (group_id, actor.project_id))
