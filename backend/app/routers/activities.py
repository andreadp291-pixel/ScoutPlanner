from fastapi import APIRouter, Depends, HTTPException

from ..db import get_conn
from ..deps import Actor, require_project_role
from ..schemas import ActivityCreateIn, ActivityOut, ActivitySwapIn, ActivityUpdateIn

router = APIRouter(prefix="/projects/{project_id}/activities", tags=["activities"])


def _check_no_overlap(conn, project_id: int, exclude_id: int | None, start_at: str, end_at: str) -> None:
    date_part = start_at[:10]
    row = conn.execute(
        """SELECT * FROM activities
           WHERE project_id = ? AND id != ? AND start_at LIKE ?
             AND start_at < ? AND ? < end_at""",
        (project_id, exclude_id or -1, f"{date_part}%", end_at, start_at),
    ).fetchone()
    if row:
        raise HTTPException(409, f"Si sovrappone a '{row['title']}'")


def _group_ids_for(conn, activity_id: int) -> list[int]:
    rows = conn.execute(
        "SELECT group_id FROM activity_groups WHERE activity_id = ? ORDER BY group_id", (activity_id,)
    ).fetchall()
    return [r["group_id"] for r in rows]


def _set_activity_groups(conn, project_id: int, activity_id: int, group_ids: list[int]) -> None:
    conn.execute("DELETE FROM activity_groups WHERE activity_id = ?", (activity_id,))
    if not group_ids:
        return
    valid_rows = conn.execute(
        f"SELECT id FROM groups WHERE project_id = ? AND id IN ({','.join('?' * len(group_ids))})",
        (project_id, *group_ids),
    ).fetchall()
    valid_ids = {r["id"] for r in valid_rows}
    for gid in group_ids:
        if gid in valid_ids:
            conn.execute(
                "INSERT OR IGNORE INTO activity_groups (activity_id, group_id) VALUES (?, ?)",
                (activity_id, gid),
            )


def _activity_out(conn, row) -> dict:
    data = dict(row)
    data["group_ids"] = _group_ids_for(conn, row["id"])
    return data


@router.get("", response_model=list[ActivityOut])
async def list_activities(actor: Actor = Depends(require_project_role("viewer"))):
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM activities WHERE project_id = ? ORDER BY start_at", (actor.project_id,)
        ).fetchall()
        return [_activity_out(conn, r) for r in rows]


@router.get("/{activity_id}", response_model=ActivityOut)
async def get_activity(activity_id: int, actor: Actor = Depends(require_project_role("viewer"))):
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM activities WHERE id = ? AND project_id = ?", (activity_id, actor.project_id)
        ).fetchone()
        if not row:
            raise HTTPException(404, "Attività non trovata")
        return _activity_out(conn, row)


@router.post("", response_model=ActivityOut, status_code=201)
async def create_activity(body: ActivityCreateIn, actor: Actor = Depends(require_project_role("editor"))):
    with get_conn() as conn:
        _check_no_overlap(conn, actor.project_id, None, body.start_at, body.end_at)
        cur = conn.execute(
            """INSERT INTO activities
               (project_id, title, description, location, category, color, materials, start_at, end_at, created_by)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                actor.project_id, body.title, body.description, body.location,
                body.category, body.color, body.materials, body.start_at, body.end_at, actor.name,
            ),
        )
        activity_id = cur.lastrowid
        _set_activity_groups(conn, actor.project_id, activity_id, body.group_ids)
        row = conn.execute("SELECT * FROM activities WHERE id = ?", (activity_id,)).fetchone()
        return _activity_out(conn, row)


@router.post("/swap", response_model=list[ActivityOut])
async def swap_activities(body: ActivitySwapIn, actor: Actor = Depends(require_project_role("editor"))):
    if body.id_a == body.id_b:
        raise HTTPException(400, "id_a e id_b devono essere diversi")
    with get_conn() as conn:
        row_a = conn.execute(
            "SELECT * FROM activities WHERE id = ? AND project_id = ?", (body.id_a, actor.project_id)
        ).fetchone()
        row_b = conn.execute(
            "SELECT * FROM activities WHERE id = ? AND project_id = ?", (body.id_b, actor.project_id)
        ).fetchone()
        if not row_a or not row_b:
            raise HTTPException(404, "Attività non trovata")
        conn.execute(
            "UPDATE activities SET start_at = ?, end_at = ?, updated_at = datetime('now') WHERE id = ?",
            (row_b["start_at"], row_b["end_at"], body.id_a),
        )
        conn.execute(
            "UPDATE activities SET start_at = ?, end_at = ?, updated_at = datetime('now') WHERE id = ?",
            (row_a["start_at"], row_a["end_at"], body.id_b),
        )
        result = conn.execute(
            "SELECT * FROM activities WHERE id IN (?, ?) AND project_id = ?",
            (body.id_a, body.id_b, actor.project_id),
        ).fetchall()
    return [dict(r) for r in result]


@router.patch("/{activity_id}", response_model=ActivityOut)
async def update_activity(
    activity_id: int, body: ActivityUpdateIn, actor: Actor = Depends(require_project_role("editor"))
):
    fields = body.model_dump(exclude_unset=True)
    group_ids = fields.pop("group_ids", None)
    with get_conn() as conn:
        current = conn.execute(
            "SELECT * FROM activities WHERE id = ? AND project_id = ?", (activity_id, actor.project_id)
        ).fetchone()
        if not current:
            raise HTTPException(404, "Attività non trovata")
        if "start_at" in fields or "end_at" in fields:
            new_start = fields.get("start_at", current["start_at"])
            new_end = fields.get("end_at", current["end_at"])
            _check_no_overlap(conn, actor.project_id, activity_id, new_start, new_end)
        if fields:
            set_parts = [f"{k} = ?" for k in fields] + ["updated_at = datetime('now')"]
            values = [*fields.values(), activity_id, actor.project_id]
            conn.execute(
                f"UPDATE activities SET {', '.join(set_parts)} WHERE id = ? AND project_id = ?",
                values,
            )
        if group_ids is not None:
            _set_activity_groups(conn, actor.project_id, activity_id, group_ids)
        row = conn.execute(
            "SELECT * FROM activities WHERE id = ? AND project_id = ?", (activity_id, actor.project_id)
        ).fetchone()
        return _activity_out(conn, row)


@router.delete("/{activity_id}", status_code=204)
async def delete_activity(activity_id: int, actor: Actor = Depends(require_project_role("editor"))):
    with get_conn() as conn:
        conn.execute(
            "DELETE FROM activities WHERE id = ? AND project_id = ?", (activity_id, actor.project_id)
        )
