from fastapi import APIRouter, Depends

from ..db import get_conn
from ..deps import Actor, require_project_role
from ..schemas import PersonOut


def project_people(conn, project_id: int) -> list[dict]:
    """Chi può ricevere assegnazioni: owner, membri con account, persone con link non revocato."""
    owner = conn.execute("SELECT owner_email FROM projects WHERE id = ?", (project_id,)).fetchone()
    people = [{"ref": "o", "name": owner["owner_email"], "kind": "owner"}]
    for r in conn.execute(
        """SELECT m.id, m.display_name FROM project_members pm
           JOIN members m ON m.id = pm.member_id WHERE pm.project_id = ? ORDER BY m.display_name""",
        (project_id,),
    ):
        people.append({"ref": f"m{r['id']}", "name": r["display_name"], "kind": "member"})
    for r in conn.execute(
        "SELECT id, person_name FROM project_tokens WHERE project_id = ? AND revoked_at IS NULL ORDER BY person_name",
        (project_id,),
    ):
        people.append({"ref": f"t{r['id']}", "name": r["person_name"], "kind": "link"})
    return people


router = APIRouter(prefix="/projects/{project_id}/people", tags=["people"])


@router.get("", response_model=list[PersonOut])
def list_people(actor: Actor = Depends(require_project_role("viewer"))):
    with get_conn() as conn:
        return project_people(conn, actor.project_id)
