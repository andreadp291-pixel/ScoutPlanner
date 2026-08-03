from fastapi import APIRouter, Depends, HTTPException

from ..config import FRONTEND_BASE_URL
from ..db import get_conn
from ..deps import Actor, require_project_role
from ..mail import send_share_link_email
from ..schemas import TokenCreatedOut, TokenCreateIn, TokenOut
from ..security import generate_share_token, hash_share_token

router = APIRouter(prefix="/projects/{project_id}/tokens", tags=["tokens"])

TOKEN_FIELDS = "id, person_name, email, role, revoked_at, created_at, last_used_at"


def _build_share_link(project_id: int, raw_token: str) -> str:
    return f"{FRONTEND_BASE_URL}/#/projects/{project_id}?t={raw_token}"


@router.get("", response_model=list[TokenOut])
async def list_tokens(actor: Actor = Depends(require_project_role("owner"))):
    with get_conn() as conn:
        rows = conn.execute(
            f"SELECT {TOKEN_FIELDS} FROM project_tokens WHERE project_id = ? ORDER BY created_at",
            (actor.project_id,),
        ).fetchall()
    return [dict(r) for r in rows]


@router.post("", response_model=TokenCreatedOut, status_code=201)
async def create_token(body: TokenCreateIn, actor: Actor = Depends(require_project_role("owner"))):
    raw_token = generate_share_token()
    token_hash = hash_share_token(raw_token)
    with get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO project_tokens (project_id, token_hash, person_name, email, role) VALUES (?, ?, ?, ?, ?)",
            (actor.project_id, token_hash, body.person_name, body.email, body.role),
        )
        token_id = cur.lastrowid
        row = conn.execute(
            f"SELECT {TOKEN_FIELDS} FROM project_tokens WHERE id = ?", (token_id,)
        ).fetchone()
        project = conn.execute(
            "SELECT name FROM projects WHERE id = ?", (actor.project_id,)
        ).fetchone()

    email_sent = False
    if body.email:
        link_url = _build_share_link(actor.project_id, raw_token)
        email_sent = send_share_link_email(body.email, body.person_name, project["name"], link_url)

    return {**dict(row), "raw_token": raw_token, "email_sent": email_sent}


@router.post("/{token_id}/regenerate", response_model=TokenCreatedOut)
async def regenerate_token(token_id: int, actor: Actor = Depends(require_project_role("owner"))):
    with get_conn() as conn:
        existing = conn.execute(
            f"SELECT {TOKEN_FIELDS} FROM project_tokens WHERE id = ? AND project_id = ?",
            (token_id, actor.project_id),
        ).fetchone()
        if existing is None:
            raise HTTPException(status_code=404, detail="Token non trovato")

        raw_token = generate_share_token()
        token_hash = hash_share_token(raw_token)
        conn.execute(
            "UPDATE project_tokens SET token_hash = ?, revoked_at = NULL, last_used_at = NULL WHERE id = ?",
            (token_hash, token_id),
        )
        row = conn.execute(
            f"SELECT {TOKEN_FIELDS} FROM project_tokens WHERE id = ?", (token_id,)
        ).fetchone()
        project = conn.execute(
            "SELECT name FROM projects WHERE id = ?", (actor.project_id,)
        ).fetchone()

    email_sent = False
    if row["email"]:
        link_url = _build_share_link(actor.project_id, raw_token)
        email_sent = send_share_link_email(row["email"], row["person_name"], project["name"], link_url)

    return {**dict(row), "raw_token": raw_token, "email_sent": email_sent}


@router.delete("/{token_id}", status_code=204)
async def revoke_token(token_id: int, actor: Actor = Depends(require_project_role("owner"))):
    with get_conn() as conn:
        row = conn.execute(
            "SELECT id FROM project_tokens WHERE id = ? AND project_id = ?", (token_id, actor.project_id)
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Token non trovato")
        conn.execute(
            "UPDATE project_tokens SET revoked_at = datetime('now') WHERE id = ?", (token_id,)
        )
