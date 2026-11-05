from fastapi import APIRouter, Depends, HTTPException, Path

from ..config import MEMBER_SESSION_MAX_AGE, OWNER_SESSION_MAX_AGE
from ..db import get_conn
from ..deps import Actor, get_bearer_token, require_project_role
from ..mail import _send
from ..schemas import AccessApproveIn, AccessRequestIn, AccessRequestOut, TransferIn
from ..security import verify_member_session_token, verify_owner_session_token
from .members import add_member

router = APIRouter(prefix="/projects/{project_id}", tags=["access"])


def _identity(conn, token: str) -> tuple[str, str] | None:
    """(email, nome) di chi ha una sessione valida, owner o membro; None per i link anonimi."""
    owner = verify_owner_session_token(token, max_age=OWNER_SESSION_MAX_AGE)
    if owner is not None:
        return owner["email"], owner["email"].split("@")[0]
    member = verify_member_session_token(token, max_age=MEMBER_SESSION_MAX_AGE)
    if member is not None:
        row = conn.execute("SELECT email, display_name, token_version FROM members WHERE id = ?", (member["mid"],)).fetchone()
        if row and row["token_version"] == member["tv"]:
            return row["email"], row["display_name"]
    return None


@router.post("/access-requests", response_model=AccessRequestOut, status_code=201)
def request_access(body: AccessRequestIn, project_id: int = Path(...), token: str = Depends(get_bearer_token)):
    """Chiede l'accesso a un progetto: serve essere entrati con un account, ma non avere già un ruolo nel progetto."""
    with get_conn() as conn:
        project = conn.execute("SELECT owner_email FROM projects WHERE id = ?", (project_id,)).fetchone()
        who = _identity(conn, token)
        if project is None:
            raise HTTPException(404, "Progetto non trovato")
        if who is None:
            raise HTTPException(401, "Accedi con il tuo account per chiedere l'accesso")
        email, default_name = who
        if email == project["owner_email"] or conn.execute(
            "SELECT 1 FROM project_members pm JOIN members m ON m.id = pm.member_id WHERE pm.project_id = ? AND m.email = ?",
            (project_id, email),
        ).fetchone():
            raise HTTPException(409, "Hai già accesso a questo progetto")
        existing = conn.execute(
            "SELECT * FROM access_requests WHERE project_id = ? AND email = ? AND status = 'pending'", (project_id, email)
        ).fetchone()
        if existing:
            return dict(existing)
        cur = conn.execute(
            "INSERT INTO access_requests (project_id, email, name, message) VALUES (?, ?, ?, ?)",
            (project_id, email, body.name.strip() or default_name, body.message.strip()),
        )
        row = conn.execute("SELECT * FROM access_requests WHERE id = ?", (cur.lastrowid,)).fetchone()
    return dict(row)


@router.get("/access-requests", response_model=list[AccessRequestOut])
def list_requests(actor: Actor = Depends(require_project_role("owner"))):
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM access_requests WHERE project_id = ? AND status = 'pending' ORDER BY id", (actor.project_id,)
        ).fetchall()
    return [dict(r) for r in rows]


def _pending(conn, project_id: int, request_id: int):
    row = conn.execute(
        "SELECT * FROM access_requests WHERE id = ? AND project_id = ? AND status = 'pending'", (request_id, project_id)
    ).fetchone()
    if not row:
        raise HTTPException(404, "Richiesta non trovata")
    return row


@router.post("/access-requests/{request_id}/approve", response_model=AccessRequestOut)
def approve_request(request_id: int, body: AccessApproveIn, actor: Actor = Depends(require_project_role("owner"))):
    with get_conn() as conn:
        req = _pending(conn, actor.project_id, request_id)
        project = conn.execute("SELECT name FROM projects WHERE id = ?", (actor.project_id,)).fetchone()
        add_member(conn, actor.project_id, project["name"], req["email"], req["name"], body.role)
        conn.execute("UPDATE access_requests SET status = 'approved' WHERE id = ?", (request_id,))
        row = conn.execute("SELECT * FROM access_requests WHERE id = ?", (request_id,)).fetchone()
    return dict(row)


@router.post("/access-requests/{request_id}/reject", response_model=AccessRequestOut)
def reject_request(request_id: int, actor: Actor = Depends(require_project_role("owner"))):
    with get_conn() as conn:
        _pending(conn, actor.project_id, request_id)
        conn.execute("UPDATE access_requests SET status = 'rejected' WHERE id = ?", (request_id,))
        row = conn.execute("SELECT * FROM access_requests WHERE id = ?", (request_id,)).fetchone()
    return dict(row)


@router.post("/transfer")
def transfer_ownership(body: TransferIn, actor: Actor = Depends(require_project_role("owner"))):
    """Passa il progetto a un'altra email. Chi lo cedeva resta come editor, così non perde l'accesso."""
    new_owner = body.email
    if new_owner == actor.name:
        raise HTTPException(400, "Il progetto è già tuo")
    with get_conn() as conn:
        project = conn.execute("SELECT name FROM projects WHERE id = ?", (actor.project_id,)).fetchone()
        # chi diventa owner non serve più come membro
        conn.execute(
            "DELETE FROM project_members WHERE project_id = ? AND member_id IN (SELECT id FROM members WHERE email = ?)",
            (actor.project_id, new_owner),
        )
        add_member(conn, actor.project_id, project["name"], actor.name, actor.name.split("@")[0], "editor")
        conn.execute("UPDATE projects SET owner_email = ? WHERE id = ?", (new_owner, actor.project_id))
        conn.execute("DELETE FROM access_requests WHERE project_id = ? AND email = ?", (actor.project_id, new_owner))
        if not _send(
            new_owner,
            f'Ora sei il proprietario di "{project["name"]}" — ScoutPlanner',
            f'{actor.name} ti ha ceduto il progetto "{project["name"]}" su ScoutPlanner.\n\n'
            "Accedi con questa email (link di accesso o Google) per gestirlo.",
        ):
            raise HTTPException(502, "Invio email fallito, riprova più tardi")
    return {"ok": True}
