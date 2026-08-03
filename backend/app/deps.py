from dataclasses import dataclass

from fastapi import Depends, HTTPException, Path, Request

from .config import OWNER_SESSION_MAX_AGE
from .db import get_conn
from .security import hash_share_token, verify_owner_session_token

ROLE_RANK = {"viewer": 0, "editor": 1, "owner": 2}


@dataclass
class Actor:
    role: str          # 'owner' | 'editor' | 'viewer'
    name: str           # nome persona, o email per l'owner
    project_id: int


def get_bearer_token(request: Request) -> str:
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token mancante")
    return header[len("Bearer "):]


def require_owner_session(token: str = Depends(get_bearer_token)) -> str:
    email = verify_owner_session_token(token, max_age=OWNER_SESSION_MAX_AGE)
    if email is None:
        raise HTTPException(status_code=401, detail="Sessione non valida o scaduta")
    return email


def require_project_role(min_role: str):
    if min_role not in ROLE_RANK:
        raise ValueError(f"ruolo sconosciuto: {min_role}")

    def dependency(
        project_id: int = Path(...),
        token: str = Depends(get_bearer_token),
    ) -> Actor:
        with get_conn() as conn:
            project = conn.execute(
                "SELECT id, owner_email FROM projects WHERE id = ?", (project_id,)
            ).fetchone()
            if project is None:
                raise HTTPException(status_code=404, detail="Progetto non trovato")

            email = verify_owner_session_token(token, max_age=OWNER_SESSION_MAX_AGE)
            if email is not None:
                if email != project["owner_email"]:
                    raise HTTPException(status_code=403, detail="Non sei l'owner di questo progetto")
                actor = Actor(role="owner", name=email, project_id=project_id)
            else:
                token_hash = hash_share_token(token)
                row = conn.execute(
                    """SELECT id, person_name, role FROM project_tokens
                       WHERE project_id = ? AND token_hash = ? AND revoked_at IS NULL""",
                    (project_id, token_hash),
                ).fetchone()
                if row is None:
                    raise HTTPException(status_code=401, detail="Token non valido o revocato")
                conn.execute(
                    "UPDATE project_tokens SET last_used_at = datetime('now') WHERE id = ?",
                    (row["id"],),
                )
                actor = Actor(role=row["role"], name=row["person_name"], project_id=project_id)

        if ROLE_RANK[actor.role] < ROLE_RANK[min_role]:
            raise HTTPException(status_code=403, detail="Permessi insufficienti")
        return actor

    return dependency
