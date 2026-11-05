import time

from argon2.exceptions import InvalidHashError, VerifyMismatchError
from fastapi import APIRouter, Depends, HTTPException, Query, Request

from ..config import FRONTEND_BASE_URL, GOOGLE_CLIENT_ID, LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_SECONDS, MAGIC_LINK_MAX_AGE
from ..db import get_conn
from ..deps import require_member_session, require_owner_session
from ..mail import send_magic_link_email
from ..schemas import (
    GoogleLoginIn,
    GoogleSessionOut,
    MemberChangePasswordIn,
    MemberLoginIn,
    MemberSessionOut,
    OwnerLoginIn,
    OwnerSessionOut,
    OwnerSetPasswordIn,
    RequestLinkIn,
)
from ..security import (
    create_magic_link_token,
    create_member_session_token,
    create_owner_session_token,
    ph,
    verify_google_access_token,
    verify_magic_link_token,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/request-link", status_code=202)
def request_link(body: RequestLinkIn, request: Request):
    # Senza limite chiunque potrebbe usare l'SMTP per spedire email a un indirizzo a caso.
    _check_rate_limit(request, body.email)
    _record_login_attempt(request, body.email)
    token = create_magic_link_token(body.email)
    link_url = f"{FRONTEND_BASE_URL}/#/auth/callback?token={token}"
    send_magic_link_email(body.email, link_url)
    return {"detail": "Se l'email è valida, riceverai un link di accesso"}


@router.get("/verify")
def verify(token: str = Query(...)):
    email = verify_magic_link_token(token, max_age=MAGIC_LINK_MAX_AGE)
    if email is None:
        raise HTTPException(status_code=401, detail="Link non valido o scaduto")
    with get_conn() as conn:
        conn.execute("INSERT OR IGNORE INTO owners (email) VALUES (?)", (email,))
        row = conn.execute("SELECT token_version FROM owners WHERE email = ?", (email,)).fetchone()
    session_token = create_owner_session_token(email, row["token_version"])
    return {"session_token": session_token, "email": email}


# Rate limit login membri: max LOGIN_MAX_ATTEMPTS tentativi / LOGIN_WINDOW_SECONDS per (ip, email)
_login_attempts: dict[str, list[float]] = {}


def _rate_limit_key(request: Request, email: str) -> str:
    return f"{request.client.host if request.client else 'unknown'}:{email}"


def _check_rate_limit(request: Request, email: str) -> None:
    key = _rate_limit_key(request, email)
    now = time.time()
    attempts = [t for t in _login_attempts.get(key, []) if now - t < LOGIN_WINDOW_SECONDS]
    if attempts:
        _login_attempts[key] = attempts
    else:
        _login_attempts.pop(key, None)  # evita che il dizionario cresca per sempre
    if len(attempts) >= LOGIN_MAX_ATTEMPTS:
        raise HTTPException(status_code=429, detail="Troppi tentativi, riprova tra qualche minuto")


def _record_login_attempt(request: Request, email: str) -> None:
    key = _rate_limit_key(request, email)
    _login_attempts.setdefault(key, []).append(time.time())


@router.post("/member/login", response_model=MemberSessionOut)
def member_login(body: MemberLoginIn, request: Request):
    _check_rate_limit(request, body.email)
    _record_login_attempt(request, body.email)

    with get_conn() as conn:
        row = conn.execute(
            "SELECT id, display_name, password_hash, must_change_password, token_version FROM members WHERE email = ?",
            (body.email,),
        ).fetchone()

    if row is None:
        raise HTTPException(status_code=401, detail="Credenziali non valide")

    try:
        ph.verify(row["password_hash"], body.password)
    except (VerifyMismatchError, InvalidHashError):
        raise HTTPException(status_code=401, detail="Credenziali non valide")

    session_token = create_member_session_token(row["id"], row["token_version"])
    return {
        "session_token": session_token,
        "display_name": row["display_name"],
        "must_change_password": bool(row["must_change_password"]),
    }


@router.post("/member/change-password", response_model=MemberSessionOut)
def member_change_password(body: MemberChangePasswordIn, member: dict = Depends(require_member_session)):
    new_hash = ph.hash(body.new_password)
    with get_conn() as conn:
        conn.execute(
            "UPDATE members SET password_hash = ?, must_change_password = 0, token_version = token_version + 1 WHERE id = ?",
            (new_hash, member["id"]),
        )
        row = conn.execute(
            "SELECT display_name, token_version FROM members WHERE id = ?", (member["id"],)
        ).fetchone()

    # Riemette subito un token nuovo per la sessione corrente, cosi' l'utente
    # che ha appena cambiato la password non viene disconnesso lui stesso
    # (le altre sessioni aperte altrove restano invalidate dal token_version).
    session_token = create_member_session_token(member["id"], row["token_version"])
    return {"session_token": session_token, "display_name": row["display_name"], "must_change_password": False}


@router.post("/owner/set-password", response_model=OwnerSessionOut)
def owner_set_password(body: OwnerSetPasswordIn, email: str = Depends(require_owner_session)):
    new_hash = ph.hash(body.new_password)
    with get_conn() as conn:
        conn.execute(
            """INSERT INTO owners (email, password_hash, token_version) VALUES (?, ?, 1)
               ON CONFLICT(email) DO UPDATE SET password_hash = excluded.password_hash,
                                                 token_version = owners.token_version + 1""",
            (email, new_hash),
        )
        row = conn.execute("SELECT token_version FROM owners WHERE email = ?", (email,)).fetchone()

    # Riemette subito un token nuovo per la sessione corrente (le altre sessioni
    # aperte altrove restano invalidate dal token_version, come per i membri).
    session_token = create_owner_session_token(email, row["token_version"])
    return {"session_token": session_token, "email": email}


@router.post("/owner/login", response_model=OwnerSessionOut)
def owner_login(body: OwnerLoginIn, request: Request):
    _check_rate_limit(request, body.email)
    _record_login_attempt(request, body.email)

    with get_conn() as conn:
        row = conn.execute(
            "SELECT password_hash, token_version FROM owners WHERE email = ?", (body.email,)
        ).fetchone()

    if row is None or row["password_hash"] is None:
        # Stesso messaggio di una password sbagliata: non rivela quali email sono owner.
        raise HTTPException(status_code=401, detail="Credenziali non valide")

    try:
        ph.verify(row["password_hash"], body.password)
    except (VerifyMismatchError, InvalidHashError):
        raise HTTPException(status_code=401, detail="Credenziali non valide")

    session_token = create_owner_session_token(body.email, row["token_version"])
    return {"session_token": session_token, "email": body.email}


@router.post("/google", response_model=GoogleSessionOut)
def google_login(body: GoogleLoginIn):
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Login con Google non configurato")
    info = verify_google_access_token(body.access_token, GOOGLE_CLIENT_ID)
    if info is None:
        raise HTTPException(status_code=401, detail="Accesso con Google non valido")
    email = info["email"]

    with get_conn() as conn:
        # Come per il magic link: un'email verificata diventa owner al primo accesso.
        conn.execute("INSERT OR IGNORE INTO owners (email) VALUES (?)", (email,))
        owner = conn.execute("SELECT token_version FROM owners WHERE email = ?", (email,)).fetchone()
        owner_projects = conn.execute(
            "SELECT COUNT(*) AS n FROM projects WHERE owner_email = ?", (email,)
        ).fetchone()["n"]
        member = conn.execute(
            "SELECT id, display_name, token_version FROM members WHERE email = ?", (email,)
        ).fetchone()
        if member is not None:
            # Google ha già provato che l'email è sua: la password provvisoria non serve più.
            conn.execute("UPDATE members SET must_change_password = 0 WHERE id = ?", (member["id"],))

    out = {
        "owner": {"session_token": create_owner_session_token(email, owner["token_version"]), "email": email},
        "member": None,
        "owner_projects": owner_projects,
    }
    if member is not None:
        out["member"] = {
            "session_token": create_member_session_token(member["id"], member["token_version"]),
            "display_name": member["display_name"],
            "must_change_password": False,
        }
    return out
