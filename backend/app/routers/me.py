from fastapi import APIRouter, Depends

from ..db import get_conn
from ..deps import require_member_session
from ..schemas import MemberProjectOut

router = APIRouter(prefix="/me", tags=["me"])


@router.get("/projects", response_model=list[MemberProjectOut])
async def my_projects(member: dict = Depends(require_member_session)):
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
