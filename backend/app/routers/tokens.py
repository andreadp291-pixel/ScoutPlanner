from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException

from ..db import get_conn
from ..deps import Actor, require_project_role
from ..schemas import TokenCreatedOut, TokenCreateIn, TokenOut, TokenUpdateIn
from ..security import generate_share_token, hash_share_token

router = APIRouter(prefix="/projects/{project_id}/tokens", tags=["tokens"])

TOKEN_FIELDS = "id, person_name, role, revoked_at, created_at, last_used_at, expires_at"


def _expiry(days: int | None) -> str | None:
    if not days:
        return None
    return (datetime.now(timezone.utc) + timedelta(days=days)).strftime("%Y-%m-%d %H:%M:%S")


@router.get("", response_model=list[TokenOut])
def list_tokens(actor: Actor = Depends(require_project_role("owner"))):
    with get_conn() as conn:
        rows = conn.execute(
            f"SELECT {TOKEN_FIELDS} FROM project_tokens WHERE project_id = ? ORDER BY created_at",
            (actor.project_id,),
        ).fetchall()
    return [dict(r) for r in rows]


@router.post("", response_model=TokenCreatedOut, status_code=201)
def create_token(body: TokenCreateIn, actor: Actor = Depends(require_project_role("owner"))):
    raw_token = generate_share_token()
    token_hash = hash_share_token(raw_token)
    expires_at = _expiry(body.expires_in_days)
    with get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO project_tokens (project_id, token_hash, person_name, role, expires_at) VALUES (?, ?, ?, ?, ?)",
            (actor.project_id, token_hash, body.person_name, body.role, expires_at),
        )
        token_id = cur.lastrowid
        row = conn.execute(
            f"SELECT {TOKEN_FIELDS} FROM project_tokens WHERE id = ?", (token_id,)
        ).fetchone()
    return {**dict(row), "raw_token": raw_token}


@router.patch("/{token_id}", response_model=TokenOut)
def update_token(token_id: int, body: TokenUpdateIn, actor: Actor = Depends(require_project_role("owner"))):
    with get_conn() as conn:
        if conn.execute("SELECT 1 FROM project_tokens WHERE id = ? AND project_id = ?", (token_id, actor.project_id)).fetchone() is None:
            raise HTTPException(status_code=404, detail="Token non trovato")
        if body.role:
            conn.execute("UPDATE project_tokens SET role = ? WHERE id = ?", (body.role, token_id))
        if body.no_expiry or body.expires_in_days:
            conn.execute("UPDATE project_tokens SET expires_at = ? WHERE id = ?", (_expiry(body.expires_in_days), token_id))
        row = conn.execute(f"SELECT {TOKEN_FIELDS} FROM project_tokens WHERE id = ?", (token_id,)).fetchone()
    return dict(row)


@router.post("/{token_id}/regenerate", response_model=TokenCreatedOut)
def regenerate_token(token_id: int, actor: Actor = Depends(require_project_role("owner"))):
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
    return {**dict(row), "raw_token": raw_token}


@router.delete("/{token_id}", status_code=204)
def revoke_token(token_id: int, actor: Actor = Depends(require_project_role("owner"))):
    with get_conn() as conn:
        row = conn.execute(
            "SELECT id FROM project_tokens WHERE id = ? AND project_id = ?", (token_id, actor.project_id)
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Token non trovato")
        conn.execute(
            "UPDATE project_tokens SET revoked_at = datetime('now') WHERE id = ?", (token_id,)
        )
