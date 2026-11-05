import json

from fastapi import APIRouter, Depends, HTTPException

from ..db import get_conn
from ..deps import Actor, require_project_role
from ..schemas import HistoryOut, TrashItemOut

router = APIRouter(prefix="/projects/{project_id}", tags=["history"])

TRASH_DAYS = 30
FIELD_LABELS = {
    "title": "titolo", "description": "descrizione", "location": "luogo", "category": "categoria", "color": "colore",
    "materials": "materiali", "start_at": "inizio", "end_at": "fine", "group_ids": "gruppi", "assignees": "persone",
    "content": "contenuto",
}
_TABLES = {"activity": "activities", "page": "project_pages"}
_ACTIVITY_FIELDS = ("title", "description", "location", "category", "color", "materials", "start_at", "end_at")


def log_change(
    conn, actor: Actor, entity: str, entity_id: int, action: str, title: str, summary: str = "", before=None, for_ref: str | None = None
) -> None:
    conn.execute(
        "INSERT INTO activity_log (project_id, entity, entity_id, action, actor, actor_ref, title, summary, before, for_ref)"
        " VALUES (?,?,?,?,?,?,?,?,?,?)",
        (actor.project_id, entity, entity_id, action, actor.name, actor.ref, title, summary,
         json.dumps(before) if before is not None else None, for_ref),
    )


def last_editor(conn, project_id: int, entity: str, entity_id: int) -> str:
    row = conn.execute(
        "SELECT actor FROM activity_log WHERE project_id = ? AND entity = ? AND entity_id = ? AND for_ref IS NULL ORDER BY id DESC LIMIT 1",
        (project_id, entity, entity_id),
    ).fetchone()
    return row["actor"] if row else "qualcun altro"


def purge_trash() -> None:
    """Elimina per sempre ciò che è nel cestino da più di 30 giorni."""
    with get_conn() as conn:
        for table in _TABLES.values():
            conn.execute(f"DELETE FROM {table} WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now', ?)", (f"-{TRASH_DAYS} days",))


@router.get("/history", response_model=list[HistoryOut])
def list_history(limit: int = 100, actor: Actor = Depends(require_project_role("viewer"))):
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM activity_log WHERE project_id = ? AND for_ref IS NULL ORDER BY id DESC LIMIT ?", (actor.project_id, min(max(limit, 1), 500))
        ).fetchall()
    return [{**{k: r[k] for k in ("id", "entity", "entity_id", "action", "actor", "title", "summary", "created_at")},
             "restorable": r["before"] is not None} for r in rows]


@router.post("/history/{log_id}/restore")
def restore_version(log_id: int, actor: Actor = Depends(require_project_role("editor"))):
    """Riporta un'attività o una pagina com'era prima di quella modifica."""
    from .activities import _activity_out, _check_no_overlap, _check_times, _set_activity_assignees, _set_activity_groups

    with get_conn() as conn:
        entry = conn.execute("SELECT * FROM activity_log WHERE id = ? AND project_id = ?", (log_id, actor.project_id)).fetchone()
        if not entry or entry["before"] is None:
            raise HTTPException(404, "Versione non trovata")
        table = _TABLES[entry["entity"]]
        current = conn.execute(
            f"SELECT * FROM {table} WHERE id = ? AND project_id = ? AND deleted_at IS NULL", (entry["entity_id"], actor.project_id)
        ).fetchone()
        if not current:
            raise HTTPException(409, "L'elemento è nel cestino o non esiste più: ripristinalo prima dal cestino")
        snap = json.loads(entry["before"])
        if entry["entity"] == "activity":
            _check_times(snap["start_at"], snap["end_at"])
            _check_no_overlap(conn, actor.project_id, current["id"], snap["start_at"], snap["end_at"])
            now = _activity_out(conn, current)
            sets = ", ".join(f"{k} = ?" for k in _ACTIVITY_FIELDS)
            conn.execute(f"UPDATE activities SET {sets}, updated_at = datetime('now') WHERE id = ?",
                         (*[snap[k] for k in _ACTIVITY_FIELDS], current["id"]))
            _set_activity_groups(conn, actor.project_id, current["id"], snap["group_ids"])
            _set_activity_assignees(conn, actor.project_id, current["id"], snap["assignees"])
        else:
            now = dict(current)
            conn.execute("UPDATE project_pages SET title = ?, content = ?, updated_at = datetime('now') WHERE id = ?",
                         (snap["title"], snap["content"], current["id"]))
        log_change(conn, actor, entry["entity"], current["id"], "restore", snap["title"], "versione precedente ripristinata", now)
    return {"ok": True}


@router.get("/trash", response_model=list[TrashItemOut])
def list_trash(actor: Actor = Depends(require_project_role("viewer"))):
    purge_trash()
    items = []
    with get_conn() as conn:
        for entity, table in _TABLES.items():
            for r in conn.execute(f"SELECT id, title, deleted_at FROM {table} WHERE project_id = ? AND deleted_at IS NOT NULL", (actor.project_id,)):
                items.append({"entity": entity, "id": r["id"], "title": r["title"], "deleted_at": r["deleted_at"]})
    return sorted(items, key=lambda i: i["deleted_at"], reverse=True)


def _trashed(conn, actor: Actor, entity: str, entity_id: int):
    if entity not in _TABLES:
        raise HTTPException(404, "Elemento non trovato")
    row = conn.execute(
        f"SELECT * FROM {_TABLES[entity]} WHERE id = ? AND project_id = ? AND deleted_at IS NOT NULL", (entity_id, actor.project_id)
    ).fetchone()
    if not row:
        raise HTTPException(404, "Elemento non trovato nel cestino")
    return row


@router.post("/trash/{entity}/{entity_id}/restore")
def restore_from_trash(entity: str, entity_id: int, actor: Actor = Depends(require_project_role("editor"))):
    from .activities import _check_no_overlap

    with get_conn() as conn:
        row = _trashed(conn, actor, entity, entity_id)
        if entity == "activity":
            _check_no_overlap(conn, actor.project_id, entity_id, row["start_at"], row["end_at"])
        conn.execute(f"UPDATE {_TABLES[entity]} SET deleted_at = NULL WHERE id = ?", (entity_id,))
        log_change(conn, actor, entity, entity_id, "restore", row["title"], "recuperata dal cestino")
    return {"ok": True}


@router.delete("/trash/{entity}/{entity_id}", status_code=204)
def delete_forever(entity: str, entity_id: int, actor: Actor = Depends(require_project_role("editor"))):
    with get_conn() as conn:
        row = _trashed(conn, actor, entity, entity_id)
        conn.execute(f"DELETE FROM {_TABLES[entity]} WHERE id = ?", (entity_id,))
        log_change(conn, actor, entity, entity_id, "purge", row["title"], "eliminata per sempre")
