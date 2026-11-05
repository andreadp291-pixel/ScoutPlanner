from fastapi import APIRouter, BackgroundTasks, Depends

from ..deps import Actor, require_project_role
from ..notify import now_local, send_project_reminders, send_project_report

router = APIRouter(prefix="/projects/{project_id}/report", tags=["report"])


@router.post("/send", status_code=202)
def send_report_now(background: BackgroundTasks, actor: Actor = Depends(require_project_role("owner"))):
    """Manda a tutti il report delle attività assegnate. Solo a richiesta: durante il campo non parte niente da solo."""
    background.add_task(send_project_report, actor.project_id, now_local())
    return {"ok": True}


@router.post("/remind", status_code=202)
def send_reminders_now(background: BackgroundTasks, actor: Actor = Depends(require_project_role("owner"))):
    """Manda subito il promemoria "ti mancano da compilare" a chi ha attività assegnate ancora vuote."""
    background.add_task(send_project_reminders, actor.project_id, now_local(), True)
    return {"ok": True}
