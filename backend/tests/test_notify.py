import os
import sqlite3
from datetime import datetime

import pytest
from test_api import ACT, client, owner, project  # noqa: F401  (fixture e helper condivisi)

from app import notify
from app.security import create_member_session_token


@pytest.fixture
def outbox(monkeypatch):
    sent = []
    monkeypatch.setattr(notify, "_send", lambda to, subject, body: sent.append((to, subject, body)) or True)
    return sent


def _member(client, base, h, email="m@x.it", role="editor"):
    """Invita una persona con account e la rende subito attiva. Restituisce (ref, header di sessione)."""
    client.post(f"{base}/members", json={"person_name": "Mia", "email": email, "role": role}, headers=h)
    with sqlite3.connect(os.environ["DB_PATH"]) as c:
        mid = c.execute("SELECT id FROM members WHERE email = ?", (email,)).fetchone()[0]
        c.execute("UPDATE members SET must_change_password = 0 WHERE id = ?", (mid,))
    return f"m{mid}", {"Authorization": f"Bearer {create_member_session_token(mid, 0)}"}


def test_assignment_change_and_comment_emails(client, project, outbox):
    h, base = owner(), f"/projects/{project}"
    ref, mia = _member(client, base, h)
    aid = client.post(f"{base}/activities", json={**ACT, "assignees": [ref]}, headers=h).json()["id"]
    assert [(to, "Ti hanno assegnato" in s) for to, s, _ in outbox] == [("m@x.it", True)]
    outbox.clear()
    # cambia l'orario: chi è responsabile viene avvisato; cambiare solo i gruppi no
    client.patch(f"{base}/activities/{aid}", json={"start_at": "2026-07-01T11:00", "end_at": "2026-07-01T12:00"}, headers=h)
    assert [(to, "modificata" in s) for to, s, _ in outbox] == [("m@x.it", True)]
    outbox.clear()
    client.patch(f"{base}/activities/{aid}", json={"group_ids": []}, headers=h)
    assert outbox == []
    # l'editor che modifica non avvisa se stesso
    client.patch(f"{base}/activities/{aid}", json={"title": "Nuovo"}, headers=mia)
    assert outbox == []
    # commento dell'owner: arriva alla responsabile; la sua risposta torna all'owner
    cid = client.post(f"{base}/comments", json={"entity": "activity", "entity_id": aid, "body": "Serve la corda"}, headers=h).json()["id"]
    assert [to for to, _, _ in outbox] == ["m@x.it"]
    outbox.clear()
    client.post(f"{base}/comments", json={"entity": "activity", "entity_id": aid, "parent_id": cid, "body": "Ok"}, headers=mia)
    assert [to for to, _, _ in outbox] == ["o@x.it"]


def test_email_prefs_opt_out(client, project, outbox):
    h, base = owner(), f"/projects/{project}"
    ref, mia = _member(client, base, h, "off@x.it")
    assert client.get("/me/email-prefs", headers=mia).json() == {"notifications": True, "report": True}
    assert client.put("/me/email-prefs", json={"notifications": False, "report": True}, headers=mia).status_code == 200
    client.post(f"{base}/activities", json={**ACT, "assignees": [ref]}, headers=h)
    assert outbox == []  # ha disattivato le notifiche
    assert client.get("/me/email-prefs").status_code == 401


def test_done_state(client, project, outbox):
    h, base = owner(), f"/projects/{project}"
    ref, mia = _member(client, base, h)
    _, spy = _member(client, base, h, "spy@x.it", "viewer")
    aid = client.post(f"{base}/activities", json={**ACT, "assignees": [ref]}, headers=h).json()["id"]
    url = f"{base}/activities/{aid}/done"
    assert client.patch(url, json={"done": True}, headers=h).status_code == 409  # l'owner non è tra i responsabili
    assert client.patch(url, json={"done": True, "person_ref": ref}, headers=spy).status_code == 403  # non la parte di un altro
    assert client.patch(url, json={"done": True}, headers=mia).json()["done_refs"] == [ref]
    assert client.get(f"{base}/activities/{aid}", headers=h).json()["done_refs"] == [ref]
    # cambiare altro non cancella il "fatto"; riaprire sì
    client.patch(f"{base}/activities/{aid}", json={"assignees": [ref, "o"]}, headers=h)
    assert client.get(f"{base}/activities/{aid}", headers=h).json()["done_refs"] == [ref]
    assert client.patch(url, json={"done": False, "person_ref": ref}, headers=h).json()["done_refs"] == []


def test_report_content_and_daily_run(client, project, outbox):
    h, base = owner(), f"/projects/{project}"
    ref, _ = _member(client, base, h)
    mk = lambda title, s, e: client.post(
        f"{base}/activities",
        json={**ACT, "title": title, "start_at": f"2026-07-01T{s}", "end_at": f"2026-07-01T{e}", "assignees": [ref]},
        headers=h,
    ).json()["id"]
    done_id, _late, _todo = mk("Fatta", "08:00", "09:00"), mk("In ritardo", "09:00", "10:00"), mk("Da fare", "15:00", "16:00")
    client.patch(f"{base}/activities/{done_id}/done", json={"done": True, "person_ref": ref}, headers=h)
    outbox.clear()
    now = datetime(2026, 7, 1, 12, 0)
    assert notify.send_project_report(project, now) == 2  # Mia e l'owner
    body = dict((to, b) for to, _, b in outbox)["m@x.it"]
    assert "1 fatte, 1 da fare, 1 in ritardo" in body
    assert body.index("In ritardo:") < body.index("Da fare:") < body.index("Fatte:")
    owner_body = dict((to, b) for to, _, b in outbox)["o@x.it"]
    assert "STATO DEL PROGETTO" in owner_body and "Mia: 1 fatte, 1 da fare, 1 in ritardo" in owner_body
    assert "STATO DEL PROGETTO" not in body
    # automatico: durante il campo non parte niente (niente "la tua prossima attività è...")
    outbox.clear()
    assert notify.run_daily_reminders(datetime(2026, 7, 2, 7, 0)) == 0 and outbox == []
    # prima del campo: non prima delle 7, e una volta sola al giorno
    assert notify.run_daily_reminders(datetime(2026, 6, 27, 6, 59)) == 0
    assert notify.run_daily_reminders(datetime(2026, 6, 28, 7, 0)) >= 2
    assert notify.run_daily_reminders(datetime(2026, 6, 28, 9, 0)) == 0
    # a mano, solo l'owner
    assert client.post(f"{base}/report/send", headers=h).status_code == 202
    assert client.post(f"{base}/report/send", headers=_member(client, base, h, "e@x.it")[1]).status_code == 403


def test_to_fill_reminders(client, project, outbox):
    h, base = owner(), f"/projects/{project}"
    ref, _ = _member(client, base, h, "scrive@x.it")
    doc = '{"blocks":[{"id":"a","type":"title","text":"Piano"}]}'
    mk = lambda title, day, desc="": client.post(
        f"{base}/activities",
        json={**ACT, "title": title, "description": desc, "start_at": f"2026-07-0{day}T09:00", "end_at": f"2026-07-0{day}T10:00", "assignees": [ref]},
        headers=h,
    ).json()["id"]
    mk("Vuota uno", 3)
    mk("Vuota due", 4)
    mk("Compilata", 5, doc)
    mk("Già passata", 1)  # prima di "adesso": non serve più scriverla
    outbox.clear()
    now = datetime(2026, 7, 2, 7, 0)
    assert notify.send_project_reminders(project, now) == 2  # chi scrive e l'owner
    mails = {to: (s, b) for to, s, b in outbox}
    subject, body = mails["scrive@x.it"]
    assert "2 attività" in subject and "Vuota uno" in body and "Vuota due" in body
    assert "Compilata" not in body and "Già passata" not in body and "/activities/" in body
    assert "CHI DEVE ANCORA COMPILARE" in mails["o@x.it"][1] and "Mia" in mails["o@x.it"][1]
    # non si riscrive prima di 3 giorni, ma a mano sì
    outbox.clear()
    assert notify.send_project_reminders(project, datetime(2026, 7, 3, 7, 0)) == 0
    assert notify.send_project_reminders(project, datetime(2026, 7, 2, 12, 0), force=True) == 2
    assert client.post(f"{base}/report/remind", headers=h).status_code == 202
    # tutto compilato: niente da dire
    for a in client.get(f"{base}/activities", headers=h).json():
        client.patch(f"{base}/activities/{a['id']}", json={"description": doc}, headers=h)
    outbox.clear()
    assert notify.send_project_reminders(project, datetime(2026, 7, 9, 7, 0), force=True) == 0
    assert notify.is_compiled(doc) and not notify.is_compiled("") and not notify.is_compiled('{"blocks":[]}') and not notify.is_compiled("testo vecchio")
