import re

from fastapi import APIRouter, Depends, HTTPException

from ..db import get_conn
from ..deps import Actor, require_project_role
from ..schemas import MaterialAssignIn, MaterialOut
from .people import project_people

router = APIRouter(prefix="/projects/{project_id}/materials", tags=["materials"])


def _items(text: str) -> list[str]:
    # Le voci si scrivono una per riga o separate da virgola / punto e virgola.
    return [p.strip() for p in re.split(r"[\n,;]+", text) if p.strip()]


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
        for name in _items(a["materials"]):
            entry = found.setdefault(name.casefold(), {"key": name.casefold(), "name": name, "activities": []})
            if all(x["id"] != a["id"] for x in entry["activities"]):
                entry["activities"].append({"id": a["id"], "title": a["title"]})
    out = []
    for key, entry in sorted(found.items()):
        row = assigned.get(key)
        out.append(
            {
                **entry,
                "procure_ref": row["procure_ref"] if row else None,
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
        if body.procure_ref is None and body.transport_ref is None:
            conn.execute(
                "DELETE FROM material_assignments WHERE project_id = ? AND name_key = ?", (actor.project_id, key)
            )
        else:
            conn.execute(
                """INSERT INTO material_assignments (project_id, name_key, procure_ref, transport_ref)
                   VALUES (?, ?, ?, ?)
                   ON CONFLICT(project_id, name_key) DO UPDATE
                   SET procure_ref = excluded.procure_ref, transport_ref = excluded.transport_ref""",
                (actor.project_id, key, body.procure_ref, body.transport_ref),
            )
    return {
        "key": key,
        "name": body.name.strip(),
        "activities": [],
        "procure_ref": body.procure_ref,
        "transport_ref": body.transport_ref,
    }
