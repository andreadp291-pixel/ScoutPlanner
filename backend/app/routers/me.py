from fastapi import APIRouter, Depends, HTTPException

from ..db import get_conn
from ..config import OWNER_SESSION_MAX_AGE
from ..deps import get_bearer_token, require_member_session
from ..security import verify_owner_session_token
from ..schemas import EmailPrefsIO, MemberProjectOut, ProfileIO
from .access import _identity

router = APIRouter(prefix="/me", tags=["me"])


@router.get("/projects", response_model=list[MemberProjectOut])
def my_projects(member: dict = Depends(require_member_session)):
    with get_conn() as conn:
        rows = conn.execute(
            """SELECT p.id AS id, p.name AS name, p.start_date AS start_date, p.end_date AS end_date,
                      pm.role AS role
               FROM project_members pm
               JOIN projects p ON p.id = pm.project_id
               WHERE pm.member_id = ?
               ORDER BY p.start_date""",
            (member["id"],),
        ).fetchall()
    return [dict(r) for r in rows]


def _my_email(conn, token: str) -> str:
    who = _identity(conn, token)
    if who is None:
        raise HTTPException(401, "Accedi con il tuo account")
    return who[0]


@router.get("/email-prefs", response_model=EmailPrefsIO)
def get_email_prefs(token: str = Depends(get_bearer_token)):
    with get_conn() as conn:
        email = _my_email(conn, token)
        row = conn.execute("SELECT notifications, report, reminder_hour FROM email_prefs WHERE email = ?", (email,)).fetchone()
    return {
        "notifications": bool(row["notifications"]) if row else True,
        "report": bool(row["report"]) if row else True,
        "reminder_hour": row["reminder_hour"] if row else 7,
    }


@router.put("/email-prefs", response_model=EmailPrefsIO)
def set_email_prefs(body: EmailPrefsIO, token: str = Depends(get_bearer_token)):
    with get_conn() as conn:
        email = _my_email(conn, token)
        conn.execute(
            """INSERT INTO email_prefs (email, notifications, report, reminder_hour) VALUES (?, ?, ?, ?)
               ON CONFLICT(email) DO UPDATE SET notifications = excluded.notifications, report = excluded.report,
                                                reminder_hour = excluded.reminder_hour""",
            (email, body.notifications, body.report, body.reminder_hour),
        )
    return body


@router.get("/profile", response_model=ProfileIO)
def get_profile(token: str = Depends(get_bearer_token)):
    with get_conn() as conn:
        who = _identity(conn, token)
    if who is None:
        raise HTTPException(401, "Accedi con il tuo account")
    return {"email": who[0], "name": who[1]}


@router.put("/profile", response_model=ProfileIO)
def set_profile(body: ProfileIO, token: str = Depends(get_bearer_token)):
    name = body.name.strip()
    if not name:
        raise HTTPException(422, "Il nome non può essere vuoto")
    with get_conn() as conn:
        email = _my_email(conn, token)
        if verify_owner_session_token(token, max_age=OWNER_SESSION_MAX_AGE) is not None:
            conn.execute(
                "INSERT INTO owners (email, display_name) VALUES (?, ?) ON CONFLICT(email) DO UPDATE SET display_name = excluded.display_name",
                (email, name),
            )
        else:
            conn.execute("UPDATE members SET display_name = ? WHERE email = ?", (name, email))
    return {"email": email, "name": name}
