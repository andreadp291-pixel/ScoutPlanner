from fastapi import APIRouter

from ..config import FRONTEND_BASE_URL, MAGIC_LINK_MAX_AGE
from ..mail import send_magic_link_email
from ..schemas import RequestLinkIn
from ..security import (
    create_magic_link_token,
    create_owner_session_token,
    verify_magic_link_token,
)
from fastapi import HTTPException, Query

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/request-link", status_code=202)
async def request_link(body: RequestLinkIn):
    token = create_magic_link_token(body.email)
    link_url = f"{FRONTEND_BASE_URL}/#/auth/callback?token={token}"
    send_magic_link_email(body.email, link_url)
    return {"detail": "Se l'email è valida, riceverai un link di accesso"}


@router.get("/verify")
async def verify(token: str = Query(...)):
    email = verify_magic_link_token(token, max_age=MAGIC_LINK_MAX_AGE)
    if email is None:
        raise HTTPException(status_code=401, detail="Link non valido o scaduto")
    session_token = create_owner_session_token(email)
    return {"session_token": session_token, "email": email}
