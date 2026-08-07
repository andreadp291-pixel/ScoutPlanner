from dataclasses import dataclass

from fastapi import Depends, HTTPException, Path, Request

from .config import MEMBER_SESSION_MAX_AGE, OWNER_SESSION_MAX_AGE
from .db import get_conn
from .security import hash_share_token, verify_member_session_token, verify_owner_session_token

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


def _owner_token_version_matches(conn, email: str, tv: int) -> bool:
    row = conn.execute("SELECT token_version FROM owners WHERE email = ?", (email,)).fetchone()
    # Nessuna riga owners = owner che non ha mai impostato una password: versione implicita 0.
    expected = row["token_version"] if row is not None else 0
    return expected == tv


def require_owner_session(token: str = Depends(get_bearer_token)) -> str:
    data = verify_owner_session_token(token, max_age=OWNER_SESSION_MAX_AGE)
    if data is None:
        raise HTTPException(status_code=401, detail="Sessione non valida o scaduta")
    with get_conn() as conn:
        if not _owner_token_version_matches(conn, data["email"], data["tv"]):
            raise HTTPException(status_code=401, detail="Sessione non più valida, effettua di nuovo il login")
    return data["email"]


def require_member_session(token: str = Depends(get_bearer_token)) -> dict:
    data = verify_member_session_token(token, max_age=MEMBER_SESSION_MAX_AGE)
    if data is None:
        raise HTTPException(status_code=401, detail="Sessione non valida o scaduta")
    with get_conn() as conn:
        row = conn.execute(
            "SELECT id, display_name, token_version FROM members WHERE id = ?", (data["mid"],)
        ).fetchone()
    if row is None or row["token_version"] != data["tv"]:
        raise HTTPException(status_code=401, detail="Sessione non più valida, effettua di nuovo il login")
    return {"id": row["id"], "display_name": row["display_name"]}


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

            owner_data = verify_owner_session_token(token, max_age=OWNER_SESSION_MAX_AGE)
            if owner_data is not None:
                if not _owner_token_version_matches(conn, owner_data["email"], owner_data["tv"]):
                    raise HTTPException(status_code=401, detail="Sessione non più valida, effettua di nuovo il login")
                if owner_data["email"] != project["owner_email"]:
                    raise HTTPException(status_code=403, detail="Non sei l'owner di questo progetto")
                actor = Actor(role="owner", name=owner_data["email"], project_id=project_id)
            else:
                member_data = verify_member_session_token(token, max_age=MEMBER_SESSION_MAX_AGE)
                if member_data is not None:
                    member_row = conn.execute(
                        "SELECT id, display_name, token_version FROM members WHERE id = ?",
                        (member_data["mid"],),
                    ).fetchone()
                    if member_row is None or member_row["token_version"] != member_data["tv"]:
                        raise HTTPException(status_code=401, detail="Sessione non più valida, effettua di nuovo il login")
                    pm = conn.execute(
                        "SELECT role FROM project_members WHERE project_id = ? AND member_id = ?",
                        (project_id, member_row["id"]),
                    ).fetchone()
                    if pm is None:
                        raise HTTPException(status_code=403, detail="Non hai accesso a questo progetto")
                    actor = Actor(role=pm["role"], name=member_row["display_name"], project_id=project_id)
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
