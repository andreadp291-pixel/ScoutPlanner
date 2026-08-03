import logging
import smtplib
from email.message import EmailMessage

from .config import SMTP_PASSWORD, SMTP_USER

logger = logging.getLogger("scoutplanner.mail")


def send_magic_link_email(to_email: str, link_url: str) -> bool:
    if not (SMTP_USER and SMTP_PASSWORD):
        logger.info("SMTP non configurato, magic link per %s: %s", to_email, link_url)
        return False

    msg = EmailMessage()
    msg["Subject"] = "Accedi a ScoutPlanner"
    msg["From"] = SMTP_USER
    msg["To"] = to_email
    msg.set_content(
        f"Clicca sul link per accedere a ScoutPlanner (valido 15 minuti):\n\n{link_url}\n\n"
        "Se non hai richiesto questo accesso, ignora questa email."
    )

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as smtp:
            smtp.login(SMTP_USER, SMTP_PASSWORD)
            smtp.send_message(msg)
        return True
    except Exception:
        logger.exception("Invio magic link fallito per %s", to_email)
        return False
