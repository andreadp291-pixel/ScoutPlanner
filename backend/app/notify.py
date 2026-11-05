"""Email di notifica (assegnazioni, modifiche, commenti), promemoria "da compilare" prima del campo e report a richiesta."""

import asyncio
import json
import logging
from datetime import date, datetime, timedelta

from .config import FRONTEND_BASE_URL
from .db import get_conn
from .mail import _send
from .routers.people import project_people

logger = logging.getLogger("scoutplanner.notify")

_DAYS = ["lun", "mar", "mer", "gio", "ven", "sab", "dom"]
_MONTHS = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"]
REPORT_HOUR = 7  # ora di base dei promemoria (italiana), ognuno può cambiarla
REMINDER_EVERY_DAYS = 3  # promemoria "da compilare": al massimo uno ogni 3 giorni a persona

FOOTER = f"\n\n—\nNon vuoi più queste email? Gestiscile qui: {FRONTEND_BASE_URL}/#/account/email"


def project_url(project_id: int, activity_id: int | None = None) -> str:
    base = f"{FRONTEND_BASE_URL}/#/projects/{project_id}"
    return f"{base}/activities/{activity_id}/description" if activity_id else base


def when_text(start_at: str, end_at: str) -> str:
    d = date.fromisoformat(start_at[:10])
    return f"{_DAYS[d.weekday()]} {d.day} {_MONTHS[d.month - 1]}, {start_at[11:16]}–{end_at[11:16]}"


def ref_contacts(conn, project_id: int, refs) -> dict[str, tuple[str, str]]:
    """ref persona -> (email, nome), solo per chi ha un indirizzo (i link anonimi senza email non ne hanno)."""
    out = {}
    for ref in set(refs):
        row = None
        if ref == "o":
            row = conn.execute("SELECT owner_email AS email, owner_email AS name FROM projects WHERE id = ?", (project_id,)).fetchone()
        elif ref[:1] == "m" and ref[1:].isdigit():
            row = conn.execute("SELECT email, display_name AS name FROM members WHERE id = ?", (int(ref[1:]),)).fetchone()
        elif ref[:1] == "t" and ref[1:].isdigit():
            row = conn.execute(
                "SELECT email, person_name AS name FROM project_tokens WHERE id = ? AND project_id = ?", (int(ref[1:]), project_id)
            ).fetchone()
        if row and row["email"]:
            out[ref] = (row["email"], row["name"])
    return out


def _opted_in(conn, emails, kind: str) -> list[str]:
    emails = sorted(set(emails))
    if not emails:
        return []
    off = {
        r["email"]
        for r in conn.execute(
            f"SELECT email FROM email_prefs WHERE {kind} = 0 AND email IN ({','.join('?' * len(emails))})", emails
        )
    }
    return [e for e in emails if e not in off]


def _hours(conn, emails) -> dict[str, int]:
    """Ora scelta da ciascuno per i promemoria (7 se non ha scelto)."""
    emails = sorted(set(emails))
    if not emails:
        return {}
    rows = conn.execute(f"SELECT email, reminder_hour FROM email_prefs WHERE email IN ({','.join('?' * len(emails))})", emails)
    chosen = {r["email"]: r["reminder_hour"] for r in rows}
    return {e: chosen.get(e, REPORT_HOUR) for e in emails}


def deliver(emails, subject: str, body: str, kind: str = "notifications") -> None:
    """Invia a chi non ha disattivato le email. Va chiamata da BackgroundTasks, dopo la risposta."""
    with get_conn() as conn:
        targets = _opted_in(conn, emails, kind)
    for email in targets:
        _send(email, subject, body + FOOTER)


def notify(background, emails, subject: str, body: str) -> None:
    emails = [e for e in emails if e]
    if emails:
        background.add_task(deliver, emails, subject, body)


# ---------------------------------------------------------------- report

def _assignments(conn, project_id: int, ref: str | None = None):
    sql = """SELECT a.id, a.title, a.start_at, a.end_at, aa.person_ref, aa.done_at
             FROM activity_assignees aa JOIN activities a ON a.id = aa.activity_id
             WHERE a.project_id = ? AND a.deleted_at IS NULL"""
    args: list = [project_id]
    if ref:
        sql += " AND aa.person_ref = ?"
        args.append(ref)
    return conn.execute(sql + " ORDER BY a.start_at", args).fetchall()


def _split(rows, now_str: str):
    done = [r for r in rows if r["done_at"]]
    late = [r for r in rows if not r["done_at"] and r["end_at"] < now_str]
    todo = [r for r in rows if not r["done_at"] and r["end_at"] >= now_str]
    return done, late, todo


def is_compiled(description: str) -> bool:
    """Un'attività è compilata se la sua descrizione è un documento con almeno un blocco (come nell'editor)."""
    try:
        doc = json.loads(description or "")
    except ValueError:
        return False
    return isinstance(doc, dict) and bool(doc.get("blocks"))


def _missing(conn, project_id: int, now_str: str, ref: str | None = None):
    """Attività assegnate, non ancora iniziate, con la descrizione ancora vuota."""
    sql = """SELECT a.id, a.title, a.start_at, a.end_at, a.description, aa.person_ref
             FROM activity_assignees aa JOIN activities a ON a.id = aa.activity_id
             WHERE a.project_id = ? AND a.deleted_at IS NULL AND a.start_at > ?"""
    args: list = [project_id, now_str]
    if ref:
        sql += " AND aa.person_ref = ?"
        args.append(ref)
    return [r for r in conn.execute(sql + " ORDER BY a.start_at", args) if not is_compiled(r["description"])]


def _lines(rows) -> str:
    return "\n".join(f"  • {r['title']} — {when_text(r['start_at'], r['end_at'])}" for r in rows) or "  (nessuna)"


def build_report(conn, project, ref: str, name: str, now: datetime) -> str | None:
    """Testo del report per una persona; None se non ha niente di assegnato (e non è l'owner di un progetto con assegnazioni)."""
    now_str = now.strftime("%Y-%m-%dT%H:%M")
    mine = _assignments(conn, project["id"], ref)
    everyone = _assignments(conn, project["id"]) if ref == "o" else []
    if not mine and not everyone:
        return None
    parts = [f"Ciao {name},\necco il punto su «{project['name']}» al {now.day} {_MONTHS[now.month - 1]}.\n"]
    if mine:
        done, late, todo = _split(mine, now_str)
        parts.append(f"LE TUE ATTIVITÀ — {len(done)} fatte, {len(todo)} da fare, {len(late)} in ritardo\n")
        if late:
            parts.append("In ritardo:\n" + _lines(late) + "\n")
        parts.append("Da fare:\n" + _lines(todo) + "\n")
        parts.append("Fatte:\n" + _lines(done) + "\n")
    to_write = _missing(conn, project["id"], now_str, ref)
    if to_write:
        parts.append(f"ANCORA DA COMPILARE ({len(to_write)})\n" + _lines(to_write) + "\n")
    if everyone:
        names = {p["ref"]: p["name"] for p in project_people(conn, project["id"])}
        parts.append("STATO DEL PROGETTO (solo per te, che sei il proprietario)")
        for pref in dict.fromkeys(r["person_ref"] for r in everyone):
            d, l, t = _split([r for r in everyone if r["person_ref"] == pref], now_str)
            parts.append(f"  • {names.get(pref, '(rimosso)')}: {len(d)} fatte, {len(t)} da fare, {len(l)} in ritardo")
        parts.append("")
    parts.append(f"Apri il progetto: {project_url(project['id'])}")
    return "\n".join(parts)


def send_project_report(project_id: int, now: datetime) -> int:
    """Manda il report a ogni persona con un'assegnazione (e all'owner). Restituisce quante email."""
    sent = 0
    with get_conn() as conn:
        project = conn.execute("SELECT id, name FROM projects WHERE id = ?", (project_id,)).fetchone()
        if project is None:
            return 0
        refs = {r["person_ref"] for r in _assignments(conn, project_id)}
        if refs:
            refs.add("o")
        contacts = ref_contacts(conn, project_id, refs)
        allowed = set(_opted_in(conn, [e for e, _ in contacts.values()], "report"))
        bodies = {}
        for ref, (email, name) in contacts.items():
            if email in allowed:
                body = build_report(conn, project, ref, name, now)
                if body:
                    bodies[email] = (project["name"], body)
    for email, (pname, body) in bodies.items():
        if _send(email, f"Il punto su «{pname}» — ScoutPlanner", body + FOOTER):
            sent += 1
    return sent


def build_reminder(conn, project, ref: str, name: str, now: datetime) -> tuple[str, str] | None:
    """(oggetto, testo) del promemoria "ti mancano da compilare"; None se non manca niente."""
    now_str = now.strftime("%Y-%m-%dT%H:%M")
    mine = _missing(conn, project["id"], now_str, ref)
    everyone = _missing(conn, project["id"], now_str) if ref == "o" else []
    if not mine and not everyone:
        return None
    parts = [f"Ciao {name},"]
    if mine:
        parts.append(f"nel vademecum «{project['name']}» ti mancano ancora da compilare {len(mine)} attività:\n")
        parts += [f"  • {r['title']} — {when_text(r['start_at'], r['end_at'])}\n    {project_url(project['id'], r['id'])}" for r in mine]
    else:
        parts.append(f"il tuo lavoro sul vademecum «{project['name']}» è a posto, ma ci sono attività altrui ancora da compilare.")
    if everyone:
        names = {p["ref"]: p["name"] for p in project_people(conn, project["id"])}
        parts.append("\nCHI DEVE ANCORA COMPILARE (solo per te, che sei il proprietario)")
        for pref in dict.fromkeys(r["person_ref"] for r in everyone):
            titles = ", ".join(r["title"] for r in everyone if r["person_ref"] == pref)
            parts.append(f"  • {names.get(pref, '(rimosso)')}: {titles}")
    parts.append(f"\nApri il progetto: {project_url(project['id'])}")
    subject = (
        f"Ti mancano da compilare {len(mine)} attività — «{project['name']}»"
        if mine
        else f"Vademecum «{project['name']}»: attività ancora da compilare"
    )
    return subject, "\n".join(parts)


def send_project_reminders(project_id: int, now: datetime, force: bool = False) -> int:
    """Promemoria a chi ha attività assegnate ancora da compilare (e all'owner). Senza force: al massimo uno ogni 3 giorni."""
    day = now.date().isoformat()
    since = (now.date() - timedelta(days=REMINDER_EVERY_DAYS - 1)).isoformat()
    now_str = now.strftime("%Y-%m-%dT%H:%M")
    with get_conn() as conn:
        project = conn.execute("SELECT id, name FROM projects WHERE id = ?", (project_id,)).fetchone()
        if project is None:
            return 0
        refs = {r["person_ref"] for r in _missing(conn, project_id, now_str)}
        if refs:
            refs.add("o")
        contacts = ref_contacts(conn, project_id, refs)
        emails = _opted_in(conn, [e for e, _ in contacts.values()], "report")
        if not force:
            hours = _hours(conn, emails)
            emails = [e for e in emails if hours[e] <= now.hour]  # non prima dell'ora scelta
            recent = {
                r["email"]
                for r in conn.execute("SELECT email FROM reminder_log WHERE project_id = ? AND day >= ?", (project_id, since))
            }
            emails = [e for e in emails if e not in recent]
        mails = []
        for ref, (email, name) in contacts.items():
            if email in emails and (built := build_reminder(conn, project, ref, name, now)):
                mails.append((email, *built))
    sent = 0
    for email, subject, body in mails:
        if _send(email, subject, body + FOOTER):
            sent += 1
            with get_conn() as conn:
                conn.execute("INSERT OR IGNORE INTO reminder_log (project_id, email, day) VALUES (?, ?, ?)", (project_id, email, day))
    return sent


def now_local() -> datetime:
    try:
        from zoneinfo import ZoneInfo

        return datetime.now(ZoneInfo("Europe/Rome")).replace(tzinfo=None)
    except Exception:  # senza database dei fusi (es. Windows): ora del computer
        return datetime.now()


def run_daily_reminders(now: datetime | None = None) -> int:
    """Controlla i campi non ancora iniziati (durante il campo non parte niente da solo). Ognuno riceve il promemoria
    all'ora che ha scelto (di base le 7); reminder_log evita di riscrivere prima di 3 giorni."""
    now = now or now_local()
    with get_conn() as conn:
        upcoming = [r["id"] for r in conn.execute("SELECT id FROM projects WHERE start_date > ?", (now.date().isoformat(),))]
    return sum(send_project_reminders(pid, now) for pid in upcoming)


async def report_loop() -> None:
    while True:
        try:
            await asyncio.to_thread(run_daily_reminders)
        except Exception:
            logger.exception("Report giornaliero fallito")
        await asyncio.sleep(1800)
