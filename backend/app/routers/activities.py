from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from ..db import get_conn
from ..deps import ROLE_RANK, Actor, require_project_role
from ..notify import notify, project_url, ref_contacts, when_text
from .history import FIELD_LABELS, last_editor, log_change
from .people import project_people
from ..schemas import ActivityCreateIn, ActivityDoneIn, ActivityOut, ActivitySwapIn, ActivityUpdateIn

router = APIRouter(prefix="/projects/{project_id}/activities", tags=["activities"])


def _check_times(start_at: str, end_at: str) -> None:
    if end_at <= start_at:
        raise HTTPException(400, "L'ora di fine deve essere dopo quella di inizio")
    if start_at[:10] != end_at[:10]:
        raise HTTPException(400, "Un'attività deve iniziare e finire nello stesso giorno")


def _check_no_overlap(conn, project_id: int, exclude_id: int | None, start_at: str, end_at: str) -> None:
    date_part = start_at[:10]
    row = conn.execute(
        """SELECT * FROM activities
           WHERE project_id = ? AND deleted_at IS NULL AND id != ? AND start_at LIKE ?
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


def _set_activity_assignees(conn, project_id: int, activity_id: int, refs: list[str]) -> list[str]:
    """Imposta i responsabili tenendo il "fatto" di chi resta. Restituisce i ref aggiunti ora."""
    before = {
        r["person_ref"]: r["done_at"]
        for r in conn.execute("SELECT person_ref, done_at FROM activity_assignees WHERE activity_id = ?", (activity_id,))
    }
    conn.execute("DELETE FROM activity_assignees WHERE activity_id = ?", (activity_id,))
    valid = {p["ref"] for p in project_people(conn, project_id)}
    added = []
    for ref in dict.fromkeys(refs):  # senza doppioni
        if ref in valid:
            conn.execute(
                "INSERT INTO activity_assignees (activity_id, person_ref, done_at) VALUES (?, ?, ?)",
                (activity_id, ref, before.get(ref)),
            )
            if ref not in before:
                added.append(ref)
    return added


def _notify_assigned(conn, background, actor: Actor, row, refs: list[str]) -> None:
    for ref in refs:
        if ref != actor.ref:  # voce per la campanella di quella persona
            log_change(conn, actor, "activity", row["id"], "assign", row["title"], "ti ha assegnato questa attività", for_ref=ref)
    contacts = ref_contacts(conn, actor.project_id, [r for r in refs if r != actor.ref])
    project = conn.execute("SELECT name FROM projects WHERE id = ?", (actor.project_id,)).fetchone()
    notify(
        background,
        [email for email, _ in contacts.values()],
        f"Ti hanno assegnato «{row['title']}» — {project['name']}",
        f"{actor.name} ti ha assegnato l'attività «{row['title']}» ({when_text(row['start_at'], row['end_at'])})"
        f" nel progetto «{project['name']}».\n\nApri l'attività: {project_url(actor.project_id, row['id'])}",
    )


def _activity_out(conn, row) -> dict:
    data = dict(row)
    data["group_ids"] = _group_ids_for(conn, row["id"])
    rows = conn.execute(
        "SELECT person_ref, done_at FROM activity_assignees WHERE activity_id = ? ORDER BY person_ref", (row["id"],)
    ).fetchall()
    data["assignees"] = [r["person_ref"] for r in rows]
    data["done_refs"] = [r["person_ref"] for r in rows if r["done_at"]]
    return data


@router.get("", response_model=list[ActivityOut])
def list_activities(actor: Actor = Depends(require_project_role("viewer"))):
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM activities WHERE project_id = ? AND deleted_at IS NULL ORDER BY start_at", (actor.project_id,)
        ).fetchall()
        return [_activity_out(conn, r) for r in rows]


@router.get("/{activity_id}", response_model=ActivityOut)
def get_activity(activity_id: int, actor: Actor = Depends(require_project_role("viewer"))):
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM activities WHERE id = ? AND project_id = ? AND deleted_at IS NULL", (activity_id, actor.project_id)
        ).fetchone()
        if not row:
            raise HTTPException(404, "Attività non trovata")
        return _activity_out(conn, row)


@router.post("", response_model=ActivityOut, status_code=201)
def create_activity(
    body: ActivityCreateIn, background: BackgroundTasks, actor: Actor = Depends(require_project_role("editor"))
):
    _check_times(body.start_at, body.end_at)
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
        added = _set_activity_assignees(conn, actor.project_id, activity_id, body.assignees)
        row = conn.execute("SELECT * FROM activities WHERE id = ?", (activity_id,)).fetchone()
        _notify_assigned(conn, background, actor, row, added)
        log_change(conn, actor, "activity", activity_id, "create", body.title)
        return _activity_out(conn, row)


@router.post("/swap", response_model=list[ActivityOut])
def swap_activities(body: ActivitySwapIn, actor: Actor = Depends(require_project_role("editor"))):
    if body.id_a == body.id_b:
        raise HTTPException(400, "id_a e id_b devono essere diversi")
    with get_conn() as conn:
        row_a = conn.execute(
            "SELECT * FROM activities WHERE id = ? AND project_id = ? AND deleted_at IS NULL", (body.id_a, actor.project_id)
        ).fetchone()
        row_b = conn.execute(
            "SELECT * FROM activities WHERE id = ? AND project_id = ? AND deleted_at IS NULL", (body.id_b, actor.project_id)
        ).fetchone()
        if not row_a or not row_b:
            raise HTTPException(404, "Attività non trovata")
        for r, other in ((row_a, row_b), (row_b, row_a)):
            log_change(conn, actor, "activity", r["id"], "update", r["title"], f"scambiata con «{other['title']}»", _activity_out(conn, r))
        conn.execute(
            "UPDATE activities SET start_at = ?, end_at = ?, updated_at = datetime('now') WHERE id = ?",
            (row_b["start_at"], row_b["end_at"], body.id_a),
        )
        conn.execute(
            "UPDATE activities SET start_at = ?, end_at = ?, updated_at = datetime('now') WHERE id = ?",
            (row_a["start_at"], row_a["end_at"], body.id_b),
        )
        result = conn.execute(
            "SELECT * FROM activities WHERE id IN (?, ?) AND project_id = ? AND deleted_at IS NULL",
            (body.id_a, body.id_b, actor.project_id),
        ).fetchall()
        return [_activity_out(conn, r) for r in result]


@router.patch("/{activity_id}", response_model=ActivityOut)
def update_activity(
    activity_id: int,
    body: ActivityUpdateIn,
    background: BackgroundTasks,
    actor: Actor = Depends(require_project_role("editor")),
):
    fields = body.model_dump(exclude_unset=True)
    expected = fields.pop("if_updated_at", None)
    group_ids = fields.pop("group_ids", None)
    assignees = fields.pop("assignees", None)
    with get_conn() as conn:
        current = conn.execute(
            "SELECT * FROM activities WHERE id = ? AND project_id = ? AND deleted_at IS NULL", (activity_id, actor.project_id)
        ).fetchone()
        if not current:
            raise HTTPException(404, "Attività non trovata")
        # shortcut: updated_at ha la precisione del secondo; due modifiche nello stesso secondo non si distinguono
        if expected is not None and current["updated_at"] != expected:
            raise HTTPException(409, f"Modifica in conflitto: {last_editor(conn, actor.project_id, 'activity', activity_id)} l'ha cambiata nel frattempo")
        if "start_at" in fields or "end_at" in fields:
            new_start = fields.get("start_at", current["start_at"])
            new_end = fields.get("end_at", current["end_at"])
            _check_times(new_start, new_end)
            _check_no_overlap(conn, actor.project_id, activity_id, new_start, new_end)
        before = _activity_out(conn, current)
        changed = [k for k, v in fields.items() if before[k] != v]
        if group_ids is not None and sorted(set(group_ids)) != before["group_ids"]:
            changed.append("group_ids")
        if assignees is not None and sorted(set(assignees)) != before["assignees"]:
            changed.append("assignees")
        if changed:
            log_change(conn, actor, "activity", activity_id, "update", before["title"],
                       "modificato: " + ", ".join(FIELD_LABELS[k] for k in changed), before)
        if fields:
            set_parts = [f"{k} = ?" for k in fields] + ["updated_at = datetime('now')"]
            values = [*fields.values(), activity_id, actor.project_id]
            conn.execute(
                f"UPDATE activities SET {', '.join(set_parts)} WHERE id = ? AND project_id = ?",
                values,
            )
        if group_ids is not None:
            _set_activity_groups(conn, actor.project_id, activity_id, group_ids)
        added = _set_activity_assignees(conn, actor.project_id, activity_id, assignees) if assignees is not None else []
        row = conn.execute(
            "SELECT * FROM activities WHERE id = ? AND project_id = ? AND deleted_at IS NULL", (activity_id, actor.project_id)
        ).fetchone()
        _notify_assigned(conn, background, actor, row, added)
        # chi era già responsabile viene avvisato se cambia qualcosa che lo riguarda (non per un semplice cambio di gruppi)
        relevant = [FIELD_LABELS[k] for k in changed if k in ("title", "location", "start_at", "end_at", "description", "materials")]
        if relevant:
            stay = [r for r in before["assignees"] if r != actor.ref and r not in added]
            contacts = ref_contacts(conn, actor.project_id, stay)
            project = conn.execute("SELECT name FROM projects WHERE id = ?", (actor.project_id,)).fetchone()
            notify(
                background,
                [email for email, _ in contacts.values()],
                f"Attività modificata: «{row['title']}» — {project['name']}",
                f"{actor.name} ha modificato l'attività «{row['title']}» ({', '.join(relevant)}).\n"
                f"Ora è {when_text(row['start_at'], row['end_at'])}.\n\nApri l'attività: {project_url(actor.project_id, row['id'])}",
            )
        return _activity_out(conn, row)


@router.patch("/{activity_id}/done", response_model=ActivityOut)
def set_done(activity_id: int, body: ActivityDoneIn, actor: Actor = Depends(require_project_role("viewer"))):
    """Segna come fatta (o da fare) la parte di una persona. Ognuno la sua; per quella degli altri serve essere editor."""
    ref = body.person_ref or actor.ref
    if ref != actor.ref and ROLE_RANK[actor.role] < ROLE_RANK["editor"]:
        raise HTTPException(403, "Puoi segnare solo la tua parte")
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM activities WHERE id = ? AND project_id = ? AND deleted_at IS NULL", (activity_id, actor.project_id)
        ).fetchone()
        if not row:
            raise HTTPException(404, "Attività non trovata")
        cur = conn.execute(
            "UPDATE activity_assignees SET done_at = CASE WHEN ? THEN datetime('now') END WHERE activity_id = ? AND person_ref = ?",
            (body.done, activity_id, ref),
        )
        if cur.rowcount == 0:
            raise HTTPException(409, "Questa persona non è tra i responsabili dell'attività")
        return _activity_out(conn, row)


@router.delete("/{activity_id}", status_code=204)
def delete_activity(activity_id: int, actor: Actor = Depends(require_project_role("editor"))):
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM activities WHERE id = ? AND project_id = ? AND deleted_at IS NULL", (activity_id, actor.project_id)
        ).fetchone()
        if row:  # va nel cestino: si può recuperare per 30 giorni
            conn.execute("UPDATE activities SET deleted_at = datetime('now') WHERE id = ?", (activity_id,))
            log_change(conn, actor, "activity", activity_id, "delete", row["title"], "spostata nel cestino")
