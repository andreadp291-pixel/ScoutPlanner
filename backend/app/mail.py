import logging
import smtplib
from email.message import EmailMessage

from .config import FRONTEND_BASE_URL, SMTP_PASSWORD, SMTP_USER

logger = logging.getLogger("scoutplanner.mail")


def _send(to_email: str, subject: str, body: str) -> bool:
    if not (SMTP_USER and SMTP_PASSWORD):
        logger.info("SMTP non configurato. Email per %s:\n%s\n%s", to_email, subject, body)
        return False

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = SMTP_USER
    msg["To"] = to_email
    msg.set_content(body)

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as smtp:
            smtp.login(SMTP_USER, SMTP_PASSWORD)
            smtp.send_message(msg)
        return True
    except Exception:
        logger.exception("Invio email fallito per %s", to_email)
        return False


def send_magic_link_email(to_email: str, link_url: str) -> bool:
    return _send(
        to_email,
        "Accedi a ScoutPlanner",
        f"Clicca sul link per accedere a ScoutPlanner (valido 15 minuti):\n\n{link_url}\n\n"
        "Se non hai richiesto questo accesso, ignora questa email.",
    )


def send_member_invite_email(to_email: str, display_name: str, project_name: str, temp_password: str) -> bool:
    login_url = f"{FRONTEND_BASE_URL}/#/login"
    return _send(
        to_email,
        f'Sei stato invitato su "{project_name}" — ScoutPlanner',
        f"Ciao {display_name},\n\n"
        f'sei stato invitato a collaborare al progetto "{project_name}" su ScoutPlanner.\n\n'
        f"Accedi qui: {login_url}\n"
        f"Email: {to_email}\n"
        f"Password provvisoria: {temp_password}\n\n"
        "Al primo accesso ti verrà chiesto di impostare una password personale.\n"
        "Questa email non verrà rinviata: conserva la password finché non l'hai cambiata.",
    )


def send_member_added_to_project_email(to_email: str, display_name: str, project_name: str) -> bool:
    login_url = f"{FRONTEND_BASE_URL}/#/login"
    return _send(
        to_email,
        f'Sei stato aggiunto a "{project_name}" — ScoutPlanner',
        f"Ciao {display_name},\n\n"
        f'sei stato aggiunto al progetto "{project_name}" su ScoutPlanner.\n\n'
        f"Accedi con le tue credenziali esistenti qui: {login_url}",
    )


def send_password_reset_email(to_email: str, display_name: str, temp_password: str) -> bool:
    login_url = f"{FRONTEND_BASE_URL}/#/login"
    return _send(
        to_email,
        "Nuova password provvisoria — ScoutPlanner",
        f"Ciao {display_name},\n\n"
        f"Ti è stata assegnata una nuova password provvisoria:\n{temp_password}\n\n"
        f"Accedi qui: {login_url}\n"
        "Al primo accesso ti verrà chiesto di impostarne una personale.",
    )
