from fastapi import APIRouter, Depends, HTTPException

from ..db import get_conn
from ..deps import Actor, require_project_role
from ..schemas import PageCreateIn, PageOut, PageUpdateIn

router = APIRouter(prefix="/projects/{project_id}/pages", tags=["project_pages"])


@router.get("", response_model=list[PageOut])
def list_pages(actor: Actor = Depends(require_project_role("viewer"))):
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM project_pages WHERE project_id = ? ORDER BY position, id", (actor.project_id,)
        ).fetchall()
    return [dict(r) for r in rows]


@router.post("", response_model=PageOut, status_code=201)
def create_page(body: PageCreateIn, actor: Actor = Depends(require_project_role("editor"))):
    with get_conn() as conn:
        next_pos = conn.execute(
            "SELECT COALESCE(MAX(position), -1) + 1 FROM project_pages WHERE project_id = ?",
            (actor.project_id,),
        ).fetchone()[0]
        cur = conn.execute(
            """INSERT INTO project_pages (project_id, title, content, position, created_by)
               VALUES (?, ?, ?, ?, ?)""",
            (actor.project_id, body.title, body.content, next_pos, actor.name),
        )
        row = conn.execute("SELECT * FROM project_pages WHERE id = ?", (cur.lastrowid,)).fetchone()
    return dict(row)


@router.get("/{page_id}", response_model=PageOut)
def get_page(page_id: int, actor: Actor = Depends(require_project_role("viewer"))):
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM project_pages WHERE id = ? AND project_id = ?", (page_id, actor.project_id)
        ).fetchone()
    if not row:
        raise HTTPException(404, "Pagina non trovata")
    return dict(row)


@router.patch("/{page_id}", response_model=PageOut)
def update_page(page_id: int, body: PageUpdateIn, actor: Actor = Depends(require_project_role("editor"))):
    with get_conn() as conn:
        current = conn.execute(
            "SELECT * FROM project_pages WHERE id = ? AND project_id = ?", (page_id, actor.project_id)
        ).fetchone()
        if not current:
            raise HTTPException(404, "Pagina non trovata")
        fields = body.model_dump(exclude_unset=True)
        if fields:
            merged = {**dict(current), **fields}
            conn.execute(
                "UPDATE project_pages SET title=?, content=?, updated_at=datetime('now') WHERE id=?",
                (merged["title"], merged["content"], page_id),
            )
        row = conn.execute("SELECT * FROM project_pages WHERE id = ?", (page_id,)).fetchone()
    return dict(row)


@router.delete("/{page_id}", status_code=204)
def delete_page(page_id: int, actor: Actor = Depends(require_project_role("editor"))):
    with get_conn() as conn:
        conn.execute("DELETE FROM project_pages WHERE id = ? AND project_id = ?", (page_id, actor.project_id))
