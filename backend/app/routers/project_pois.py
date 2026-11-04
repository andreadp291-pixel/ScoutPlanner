from fastapi import APIRouter, Depends, HTTPException

from ..db import get_conn
from ..deps import Actor, require_project_role
from ..schemas import PoiCreateIn, PoiOut, PoiUpdateIn

router = APIRouter(prefix="/projects/{project_id}/pois", tags=["project_pois"])


@router.get("", response_model=list[PoiOut])
def list_pois(actor: Actor = Depends(require_project_role("viewer"))):
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM project_pois WHERE project_id = ? ORDER BY kind, name", (actor.project_id,)
        ).fetchall()
    return [dict(r) for r in rows]


@router.post("", response_model=PoiOut, status_code=201)
def create_poi(body: PoiCreateIn, actor: Actor = Depends(require_project_role("editor"))):
    with get_conn() as conn:
        cur = conn.execute(
            """INSERT INTO project_pois (project_id, kind, name, phone, address, lat, lon, notes, hours)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                actor.project_id, body.kind, body.name, body.phone, body.address,
                body.lat, body.lon, body.notes, body.hours,
            ),
        )
        row = conn.execute("SELECT * FROM project_pois WHERE id = ?", (cur.lastrowid,)).fetchone()
    return dict(row)


@router.patch("/{poi_id}", response_model=PoiOut)
def update_poi(poi_id: int, body: PoiUpdateIn, actor: Actor = Depends(require_project_role("editor"))):
    with get_conn() as conn:
        current = conn.execute(
            "SELECT * FROM project_pois WHERE id = ? AND project_id = ?", (poi_id, actor.project_id)
        ).fetchone()
        if not current:
            raise HTTPException(404, "Punto di interesse non trovato")
        fields = body.model_dump(exclude_unset=True)
        if fields:
            merged = {**dict(current), **fields}
            conn.execute(
                """UPDATE project_pois SET kind=?, name=?, phone=?, address=?, lat=?, lon=?, notes=?, hours=?
                   WHERE id = ?""",
                (
                    merged["kind"], merged["name"], merged["phone"], merged["address"],
                    merged["lat"], merged["lon"], merged["notes"], merged["hours"], poi_id,
                ),
            )
        row = conn.execute("SELECT * FROM project_pois WHERE id = ?", (poi_id,)).fetchone()
    return dict(row)


@router.delete("/{poi_id}", status_code=204)
def delete_poi(poi_id: int, actor: Actor = Depends(require_project_role("editor"))):
    with get_conn() as conn:
        conn.execute("DELETE FROM project_pois WHERE id = ? AND project_id = ?", (poi_id, actor.project_id))
