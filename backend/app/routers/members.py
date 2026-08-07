from fastapi import APIRouter, Depends, HTTPException

from ..db import get_conn
from ..deps import Actor, require_project_role
from ..mail import send_member_added_to_project_email, send_member_invite_email, send_password_reset_email
from ..schemas import MemberInviteIn, MemberOut, MemberRoleUpdateIn
from ..security import generate_temp_password, ph

router = APIRouter(prefix="/projects/{project_id}/members", tags=["members"])

MEMBER_FIELDS = """
    pm.id AS id, m.display_name AS display_name, m.email AS email, pm.role AS role,
    m.must_change_password AS must_change_password, pm.created_at AS created_at
"""


@router.get("", response_model=list[MemberOut])
async def list_members(actor: Actor = Depends(require_project_role("owner"))):
    with get_conn() as conn:
        rows = conn.execute(
            f"""SELECT {MEMBER_FIELDS} FROM project_members pm
                JOIN members m ON m.id = pm.member_id
                WHERE pm.project_id = ? ORDER BY pm.created_at""",
            (actor.project_id,),
        ).fetchall()
    return [dict(r) for r in rows]


@router.post("", response_model=MemberOut, status_code=201)
async def invite_member(body: MemberInviteIn, actor: Actor = Depends(require_project_role("owner"))):
    with get_conn() as conn:
        project = conn.execute("SELECT name FROM projects WHERE id = ?", (actor.project_id,)).fetchone()

        existing_member = conn.execute(
            "SELECT id, display_name, must_change_password FROM members WHERE email = ?", (body.email,)
        ).fetchone()

        if existing_member is None:
            temp_password = generate_temp_password()
            password_hash = ph.hash(temp_password)
            cur = conn.execute(
                "INSERT INTO members (email, display_name, password_hash) VALUES (?, ?, ?)",
                (body.email, body.person_name, password_hash),
            )
            member_id = cur.lastrowid
            send_member_invite_email(body.email, body.person_name, project["name"], temp_password)
        else:
            member_id = existing_member["id"]
            send_member_added_to_project_email(body.email, existing_member["display_name"], project["name"])

        existing_link = conn.execute(
            "SELECT id FROM project_members WHERE project_id = ? AND member_id = ?",
            (actor.project_id, member_id),
        ).fetchone()
        if existing_link is not None:
            conn.execute("UPDATE project_members SET role = ? WHERE id = ?", (body.role, existing_link["id"]))
            project_member_id = existing_link["id"]
        else:
            cur = conn.execute(
                "INSERT INTO project_members (project_id, member_id, role) VALUES (?, ?, ?)",
                (actor.project_id, member_id, body.role),
            )
            project_member_id = cur.lastrowid

        row = conn.execute(
            f"""SELECT {MEMBER_FIELDS} FROM project_members pm
                JOIN members m ON m.id = pm.member_id
                WHERE pm.id = ?""",
            (project_member_id,),
        ).fetchone()
    return dict(row)


@router.patch("/{project_member_id}", response_model=MemberOut)
async def update_member_role(
    project_member_id: int, body: MemberRoleUpdateIn, actor: Actor = Depends(require_project_role("owner"))
):
    with get_conn() as conn:
        existing = conn.execute(
            "SELECT id FROM project_members WHERE id = ? AND project_id = ?",
            (project_member_id, actor.project_id),
        ).fetchone()
        if existing is None:
            raise HTTPException(status_code=404, detail="Persona non trovata")
        conn.execute("UPDATE project_members SET role = ? WHERE id = ?", (body.role, project_member_id))
        row = conn.execute(
            f"""SELECT {MEMBER_FIELDS} FROM project_members pm
                JOIN members m ON m.id = pm.member_id
                WHERE pm.id = ?""",
            (project_member_id,),
        ).fetchone()
    return dict(row)


@router.post("/{project_member_id}/reset-password", response_model=MemberOut)
async def reset_member_password(project_member_id: int, actor: Actor = Depends(require_project_role("owner"))):
    with get_conn() as conn:
        row = conn.execute(
            """SELECT m.id AS member_id, m.email AS email, m.display_name AS display_name
               FROM project_members pm JOIN members m ON m.id = pm.member_id
               WHERE pm.id = ? AND pm.project_id = ?""",
            (project_member_id, actor.project_id),
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Persona non trovata")

        temp_password = generate_temp_password()
        password_hash = ph.hash(temp_password)
        conn.execute(
            "UPDATE members SET password_hash = ?, must_change_password = 1, token_version = token_version + 1 WHERE id = ?",
            (password_hash, row["member_id"]),
        )
        send_password_reset_email(row["email"], row["display_name"], temp_password)

        out = conn.execute(
            f"""SELECT {MEMBER_FIELDS} FROM project_members pm
                JOIN members m ON m.id = pm.member_id
                WHERE pm.id = ?""",
            (project_member_id,),
        ).fetchone()
    return dict(out)


@router.delete("/{project_member_id}", status_code=204)
async def remove_member(project_member_id: int, actor: Actor = Depends(require_project_role("owner"))):
    with get_conn() as conn:
        row = conn.execute(
            "SELECT id FROM project_members WHERE id = ? AND project_id = ?",
            (project_member_id, actor.project_id),
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Persona non trovata")
        conn.execute("DELETE FROM project_members WHERE id = ?", (project_member_id,))
