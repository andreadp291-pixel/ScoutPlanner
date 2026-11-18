import re

from fastapi import APIRouter, Depends, HTTPException

from ..db import get_conn
from ..deps import Actor, require_project_role
from ..schemas import MaterialAssignIn, MaterialChiIn, MaterialOut
from .people import project_people

router = APIRouter(prefix="/projects/{project_id}/materials", tags=["materials"])


def _items(text: str) -> list[tuple[str, str | None]]:
    """-> [(cosa, chi)]. Riga «cosa<TAB>chi» dalla tabella dell'attività; altrimenti vecchio testo libero separato da , o ;"""
    out = []
    for line in text.split("\n"):
        if "\t" in line:
            cosa, chi = line.split("\t", 1)
            if cosa.strip():
                out.append((cosa.strip(), chi.strip() or None))
        else:
            out += [(p.strip(), None) for p in re.split(r"[,;]+", line) if p.strip()]
    return out


def _with_chi(text: str, key: str, chi: str | None, only_empty: bool) -> str:
    """Testo materiali con il «chi» della voce `key` cambiato; riscritto in formato tabella solo se cambia qualcosa."""
    rows, changed = [], False
    for cosa, old in _items(text):
        if cosa.casefold() == key and old != chi and not (only_empty and old):
            old, changed = chi, True
        rows.append(f"{cosa}\t{old or ''}")
    return "\n".join(rows) if changed else text


def fill_empty_chi(conn, project_id: int, key: str, chi: str) -> None:
    """Mette `chi` sulla voce `key` in tutte le attività dove il «chi» è vuoto (vecchio «chi lo procura»)."""
    for a in conn.execute(
        "SELECT id, materials FROM activities WHERE project_id = ? AND deleted_at IS NULL", (project_id,)
    ).fetchall():
        new = _with_chi(a["materials"], key, chi, only_empty=True)
        if new != a["materials"]:
            conn.execute("UPDATE activities SET materials = ? WHERE id = ?", (new, a["id"]))


def migrate_procure_to_activities() -> None:
    """Una volta sola (poi non trova più niente): i «chi lo procura» globali passano nelle tabelle delle attività."""
    with get_conn() as conn:
        for r in conn.execute("SELECT * FROM material_assignments WHERE procure_ref IS NOT NULL").fetchall():
            fill_empty_chi(conn, r["project_id"], r["name_key"], r["procure_ref"])
        conn.execute("UPDATE material_assignments SET procure_ref = NULL")
        conn.execute("DELETE FROM material_assignments WHERE transport_ref IS NULL")


def _valid_refs(conn, project_id: int) -> set[str]:
    groups = conn.execute("SELECT id FROM groups WHERE project_id = ?", (project_id,)).fetchall()
    return {p["ref"] for p in project_people(conn, project_id)} | {f"g{g['id']}" for g in groups}


@router.get("", response_model=list[MaterialOut])
def list_materials(actor: Actor = Depends(require_project_role("viewer"))):
    with get_conn() as conn:
        acts = conn.execute(
            "SELECT id, title, materials FROM activities WHERE project_id = ? AND deleted_at IS NULL ORDER BY start_at",
            (actor.project_id,),
        ).fetchall()
        assigned = {
            r["name_key"]: r
            for r in conn.execute("SELECT * FROM material_assignments WHERE project_id = ?", (actor.project_id,))
        }
    found: dict[str, dict] = {}
    for a in acts:
        for name, chi in _items(a["materials"]):
            entry = found.setdefault(name.casefold(), {"key": name.casefold(), "name": name, "activities": []})
            if all(x["id"] != a["id"] for x in entry["activities"]):
                entry["activities"].append({"id": a["id"], "title": a["title"], "chi": chi})
    out = []
    for key, entry in sorted(found.items()):
        row = assigned.get(key)
        out.append(
            {
                **entry,
                "transport_ref": row["transport_ref"] if row else None,
            }
        )
    return out


@router.put("", response_model=MaterialOut)
def assign_material(body: MaterialAssignIn, actor: Actor = Depends(require_project_role("editor"))):
    key = body.name.strip().casefold()
    with get_conn() as conn:
        valid = {p["ref"] for p in project_people(conn, actor.project_id)}
        for ref in (body.procure_ref, body.transport_ref):
            if ref is not None and ref not in valid:
                raise HTTPException(400, "Persona non valida per questo progetto")
        if body.procure_ref is not None:  # compatibilità (import vademecum): va nelle attività senza «chi»
            fill_empty_chi(conn, actor.project_id, key, body.procure_ref)
        if body.transport_ref is None:
            conn.execute(
                "DELETE FROM material_assignments WHERE project_id = ? AND name_key = ?", (actor.project_id, key)
            )
        else:
            conn.execute(
                """INSERT INTO material_assignments (project_id, name_key, transport_ref) VALUES (?, ?, ?)
                   ON CONFLICT(project_id, name_key) DO UPDATE SET transport_ref = excluded.transport_ref""",
                (actor.project_id, key, body.transport_ref),
            )
    return {"key": key, "name": body.name.strip(), "activities": [], "transport_ref": body.transport_ref}


@router.put("/chi", status_code=204)
def set_material_chi(body: MaterialChiIn, actor: Actor = Depends(require_project_role("editor"))):
    """Cambia il «chi» di un materiale dentro una sola attività, dalla lista generale."""
    key = body.name.strip().casefold()
    with get_conn() as conn:
        if body.chi is not None and body.chi not in _valid_refs(conn, actor.project_id):
            raise HTTPException(400, "Persona o gruppo non valido per questo progetto")
        a = conn.execute(
            "SELECT materials FROM activities WHERE id = ? AND project_id = ? AND deleted_at IS NULL",
            (body.activity_id, actor.project_id),
        ).fetchone()
        if a is None:
            raise HTTPException(404, "Attività non trovata")
        new = _with_chi(a["materials"], key, body.chi, only_empty=False)
        # shortcut: niente voce in cronologia per questo cambio; se serve, passare da update_activity
        if new != a["materials"]:
            conn.execute(
                "UPDATE activities SET materials = ?, updated_at = datetime('now') WHERE id = ?", (new, body.activity_id)
            )
