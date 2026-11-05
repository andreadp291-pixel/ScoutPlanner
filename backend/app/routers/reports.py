from fastapi import APIRouter, BackgroundTasks, Depends

from ..deps import Actor, require_project_role
from ..notify import now_local, send_project_report

router = APIRouter(prefix="/projects/{project_id}/report", tags=["report"])


@router.post("/send", status_code=202)
def send_report_now(background: BackgroundTasks, actor: Actor = Depends(require_project_role("owner"))):
    """Manda subito a tutti il report delle attività assegnate (quello automatico parte ogni mattina)."""
    background.add_task(send_project_report, actor.project_id, now_local())
    return {"ok": True}
