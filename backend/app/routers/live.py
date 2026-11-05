import threading
import time

from fastapi import APIRouter, Depends

from ..db import get_conn
from ..deps import Actor, require_project_role
from ..schemas import NotificationsOut, PresenceIn, PresenceOut

router = APIRouter(prefix="/projects/{project_id}", tags=["live"])

# Presenza: chi sta guardando o modificando, in memoria. Basta un processo solo (come sul Raspberry Pi); chi non si
# fa sentire per PRESENCE_TTL secondi sparisce. shortcut: con più processi servirebbe una tabella condivisa.
PRESENCE_TTL = 25
_presence: dict[int, dict[str, dict]] = {}
_lock = threading.Lock()


@router.post("/presence", response_model=list[PresenceOut])
def presence(body: PresenceIn, actor: Actor = Depends(require_project_role("viewer"))):
    """Dice dove sono e restituisce gli altri presenti. Il client lo richiama ogni 10 secondi."""
    now = time.time()
    with _lock:
        room = _presence.setdefault(actor.project_id, {})
        room[actor.ref] = {"name": actor.name.split("@")[0], "place": body.place, "editing": body.editing, "seen": now}
        for ref in [r for r, v in room.items() if now - v["seen"] > PRESENCE_TTL]:
            del room[ref]
        return [
            {"ref": r, "name": v["name"], "place": v["place"], "editing": v["editing"]} for r, v in room.items() if r != actor.ref
        ]


@router.get("/notifications", response_model=NotificationsOut)
def notifications(actor: Actor = Depends(require_project_role("viewer"))):
    """Novità dalla cronologia: cosa hanno fatto gli altri dall'ultima volta che ho guardato."""
    with get_conn() as conn:
        latest = conn.execute("SELECT COALESCE(MAX(id), 0) FROM activity_log WHERE project_id = ?", (actor.project_id,)).fetchone()[0]
        seen = conn.execute("SELECT last_id FROM log_seen WHERE project_id = ? AND ref = ?", (actor.project_id, actor.ref)).fetchone()
        if seen is None:  # chi arriva adesso non deve trovarsi tutta la storia come "da leggere"
            conn.execute("INSERT INTO log_seen (project_id, ref, last_id) VALUES (?, ?, ?)", (actor.project_id, actor.ref, latest))
        last = seen["last_id"] if seen else latest
        mine = "project_id = ? AND COALESCE(actor_ref, '') != ? AND (for_ref IS NULL OR for_ref = ?)"
        args = (actor.project_id, actor.ref, actor.ref)
        unread = conn.execute(f"SELECT COUNT(*) FROM activity_log WHERE {mine} AND id > ?", (*args, last)).fetchone()[0]
        rows = conn.execute(f"SELECT * FROM activity_log WHERE {mine} ORDER BY id DESC LIMIT 20", args).fetchall()
    items = [{**{k: r[k] for k in ("id", "entity", "entity_id", "action", "actor", "title", "summary", "created_at")}, "unread": r["id"] > last} for r in rows]
    return {"latest_id": latest, "unread": unread, "items": items}


@router.post("/notifications/read")
def mark_read(actor: Actor = Depends(require_project_role("viewer"))):
    with get_conn() as conn:
        latest = conn.execute("SELECT COALESCE(MAX(id), 0) FROM activity_log WHERE project_id = ?", (actor.project_id,)).fetchone()[0]
        conn.execute(
            "INSERT INTO log_seen (project_id, ref, last_id) VALUES (?, ?, ?) ON CONFLICT(project_id, ref) DO UPDATE SET last_id = excluded.last_id",
            (actor.project_id, actor.ref, latest),
        )
    return {"ok": True}
