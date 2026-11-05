from fastapi import APIRouter, Depends, HTTPException

from ..db import get_conn
from ..deps import ROLE_RANK, Actor, require_project_role
from ..schemas import CommentCreateIn, CommentOut, CommentResolveIn

router = APIRouter(prefix="/projects/{project_id}/comments", tags=["comments"])

_TABLES = {"activity": "activities", "page": "project_pages"}


@router.get("", response_model=list[CommentOut])
def list_comments(entity: str, entity_id: int, actor: Actor = Depends(require_project_role("viewer"))):
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM comments WHERE project_id = ? AND entity = ? AND entity_id = ? ORDER BY id",
            (actor.project_id, entity, entity_id),
        ).fetchall()
    return [dict(r) for r in rows]


@router.post("", response_model=CommentOut, status_code=201)
def add_comment(body: CommentCreateIn, actor: Actor = Depends(require_project_role("commenter"))):
    with get_conn() as conn:
        if not conn.execute(
            f"SELECT 1 FROM {_TABLES[body.entity]} WHERE id = ? AND project_id = ? AND deleted_at IS NULL",
            (body.entity_id, actor.project_id),
        ).fetchone():
            raise HTTPException(404, "Elemento non trovato")
        if body.parent_id is not None and not conn.execute(
            "SELECT 1 FROM comments WHERE id = ? AND project_id = ? AND entity = ? AND entity_id = ? AND parent_id IS NULL",
            (body.parent_id, actor.project_id, body.entity, body.entity_id),
        ).fetchone():
            raise HTTPException(404, "Commento a cui rispondere non trovato")
        cur = conn.execute(
            "INSERT INTO comments (project_id, entity, entity_id, parent_id, author, author_ref, body) VALUES (?,?,?,?,?,?,?)",
            (actor.project_id, body.entity, body.entity_id, body.parent_id, actor.name, actor.ref, body.body.strip()),
        )
        row = conn.execute("SELECT * FROM comments WHERE id = ?", (cur.lastrowid,)).fetchone()
    return dict(row)


@router.patch("/{comment_id}", response_model=CommentOut)
def resolve_comment(comment_id: int, body: CommentResolveIn, actor: Actor = Depends(require_project_role("commenter"))):
    """Segna come risolta (o riapre) una discussione: vale solo per i commenti di primo livello."""
    with get_conn() as conn:
        if not conn.execute(
            "SELECT 1 FROM comments WHERE id = ? AND project_id = ? AND parent_id IS NULL", (comment_id, actor.project_id)
        ).fetchone():
            raise HTTPException(404, "Commento non trovato")
        conn.execute(
            "UPDATE comments SET resolved_at = CASE WHEN ? THEN datetime('now') END WHERE id = ?", (body.resolved, comment_id)
        )
        row = conn.execute("SELECT * FROM comments WHERE id = ?", (comment_id,)).fetchone()
    return dict(row)


@router.delete("/{comment_id}", status_code=204)
def delete_comment(comment_id: int, actor: Actor = Depends(require_project_role("commenter"))):
    """Lo cancella chi l'ha scritto, oppure un editor/owner. Le risposte spariscono con la discussione."""
    with get_conn() as conn:
        row = conn.execute("SELECT author_ref FROM comments WHERE id = ? AND project_id = ?", (comment_id, actor.project_id)).fetchone()
        if not row:
            raise HTTPException(404, "Commento non trovato")
        if row["author_ref"] != actor.ref and ROLE_RANK[actor.role] < ROLE_RANK["editor"]:
            raise HTTPException(403, "Puoi cancellare solo i tuoi commenti")
        conn.execute("DELETE FROM comments WHERE id = ?", (comment_id,))
