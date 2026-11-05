"""Email di notifica (assegnazioni, modifiche, commenti) e report giornaliero delle attività assegnate."""

import asyncio
import logging
from datetime import date, datetime, timedelta

from .config import FRONTEND_BASE_URL
from .db import get_conn
from .mail import _send
from .routers.people import project_people

logger = logging.getLogger("scoutplanner.notify")

_DAYS = ["lun", "mar", "mer", "gio", "ven", "sab", "dom"]
_MONTHS = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"]
REPORT_HOUR = 7  # il report parte dalle 7 del mattino (ora italiana)

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


def now_local() -> datetime:
    try:
        from zoneinfo import ZoneInfo

        return datetime.now(ZoneInfo("Europe/Rome")).replace(tzinfo=None)
    except Exception:  # senza database dei fusi (es. Windows): ora del computer
        return datetime.now()


def run_daily_reports(now: datetime | None = None) -> int:
    """Una volta al giorno, dalle 7, per i progetti in corso (da una settimana prima dell'inizio alla fine)."""
    now = now or now_local()
    if now.hour < REPORT_HOUR:
        return 0
    day = now.date().isoformat()
    with get_conn() as conn:
        if conn.execute("SELECT 1 FROM report_runs WHERE day = ?", (day,)).fetchone():
            return 0
        conn.execute("INSERT INTO report_runs (day) VALUES (?)", (day,))  # prima di inviare: al massimo una volta
        ids = [
            r["id"]
            for r in conn.execute(
                "SELECT id FROM projects WHERE start_date <= ? AND end_date >= ?",
                ((now.date() + timedelta(days=7)).isoformat(), day),
            )
        ]
    return sum(send_project_report(pid, now) for pid in ids)


async def report_loop() -> None:
    while True:
        try:
            await asyncio.to_thread(run_daily_reports)
        except Exception:
            logger.exception("Report giornaliero fallito")
        await asyncio.sleep(1800)
