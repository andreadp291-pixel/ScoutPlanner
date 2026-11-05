from fastapi import APIRouter, Depends, HTTPException

from ..db import get_conn
from ..deps import get_bearer_token, require_member_session
from ..schemas import EmailPrefsIO, MemberProjectOut
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
