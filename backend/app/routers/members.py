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
def list_members(actor: Actor = Depends(require_project_role("owner"))):
    with get_conn() as conn:
        rows = conn.execute(
            f"""SELECT {MEMBER_FIELDS} FROM project_members pm
                JOIN members m ON m.id = pm.member_id
                WHERE pm.project_id = ? ORDER BY pm.created_at""",
            (actor.project_id,),
        ).fetchall()
    return [dict(r) for r in rows]


def add_member(conn, project_id: int, project_name: str, email: str, name: str, role: str) -> int:
    """Aggiunge (o aggiorna il ruolo di) una persona con account e le scrive. Restituisce project_members.id."""
    existing_member = conn.execute(
        "SELECT id, display_name, must_change_password FROM members WHERE email = ?", (email,)
    ).fetchone()

    if existing_member is None:
        temp_password = generate_temp_password()
        cur = conn.execute(
            "INSERT INTO members (email, display_name, password_hash) VALUES (?, ?, ?)",
            (email, name, ph.hash(temp_password)),
        )
        member_id = cur.lastrowid
        sent = send_member_invite_email(email, name, project_name, temp_password)
    else:
        member_id = existing_member["id"]
        sent = send_member_added_to_project_email(email, existing_member["display_name"], project_name)
    if not sent:
        # L'eccezione annulla la transazione: niente membro creato con una password mai arrivata.
        raise HTTPException(status_code=502, detail="Invio email fallito, riprova più tardi")

    link = conn.execute(
        "SELECT id FROM project_members WHERE project_id = ? AND member_id = ?", (project_id, member_id)
    ).fetchone()
    if link is not None:
        conn.execute("UPDATE project_members SET role = ? WHERE id = ?", (role, link["id"]))
        return link["id"]
    return conn.execute(
        "INSERT INTO project_members (project_id, member_id, role) VALUES (?, ?, ?)", (project_id, member_id, role)
    ).lastrowid


@router.post("", response_model=MemberOut, status_code=201)
def invite_member(body: MemberInviteIn, actor: Actor = Depends(require_project_role("owner"))):
    with get_conn() as conn:
        project = conn.execute("SELECT name FROM projects WHERE id = ?", (actor.project_id,)).fetchone()
        project_member_id = add_member(conn, actor.project_id, project["name"], body.email, body.person_name, body.role)
        row = conn.execute(
            f"""SELECT {MEMBER_FIELDS} FROM project_members pm
                JOIN members m ON m.id = pm.member_id
                WHERE pm.id = ?""",
            (project_member_id,),
        ).fetchone()
    return dict(row)


@router.patch("/{project_member_id}", response_model=MemberOut)
def update_member_role(
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
def reset_member_password(project_member_id: int, actor: Actor = Depends(require_project_role("owner"))):
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
        if not send_password_reset_email(row["email"], row["display_name"], temp_password):
            raise HTTPException(status_code=502, detail="Invio email fallito, riprova più tardi")

        out = conn.execute(
            f"""SELECT {MEMBER_FIELDS} FROM project_members pm
                JOIN members m ON m.id = pm.member_id
                WHERE pm.id = ?""",
            (project_member_id,),
        ).fetchone()
    return dict(out)


@router.delete("/{project_member_id}", status_code=204)
def remove_member(project_member_id: int, actor: Actor = Depends(require_project_role("owner"))):
    with get_conn() as conn:
        row = conn.execute(
            "SELECT id FROM project_members WHERE id = ? AND project_id = ?",
            (project_member_id, actor.project_id),
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Persona non trovata")
        conn.execute("DELETE FROM project_members WHERE id = ?", (project_member_id,))
