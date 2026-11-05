import os
import sqlite3
import subprocess
import sys

from test_api import ACT, client, owner, project  # noqa: F401  (fixture e helper condivisi)


def _tok(client, base, h, role, **extra):
    r = client.post(f"{base}/tokens", json={"person_name": role, "role": role, **extra}, headers=h)
    return {"Authorization": "Bearer " + r.json()["raw_token"]}


def test_comments_and_commenter_role(client, project):
    h, base = owner(), f"/projects/{project}"
    aid = client.post(f"{base}/activities", json=ACT, headers=h).json()["id"]
    com, view = _tok(client, base, h, "commenter"), _tok(client, base, h, "viewer")
    body = {"entity": "activity", "entity_id": aid, "body": "Serve la corda"}
    assert client.post(f"{base}/comments", json=body, headers=view).status_code == 403
    cid = client.post(f"{base}/comments", json=body, headers=com).json()["id"]
    assert client.post(f"{base}/comments", json={**body, "parent_id": cid, "body": "Ok"}, headers=h).status_code == 201
    # il commentatore non modifica le attività
    assert client.patch(f"{base}/activities/{aid}", json={"title": "X"}, headers=com).status_code == 403
    # si risponde solo a un commento di primo livello della stessa attività
    assert client.post(f"{base}/comments", json={**body, "parent_id": 999}, headers=com).status_code == 404
    items = client.get(f"{base}/comments?entity=activity&entity_id={aid}", headers=view).json()
    assert [c["parent_id"] for c in items] == [None, cid]
    # risolvere / riaprire
    assert client.patch(f"{base}/comments/{cid}", json={"resolved": True}, headers=com).json()["resolved_at"]
    assert client.patch(f"{base}/comments/{cid}", json={"resolved": False}, headers=com).json()["resolved_at"] is None
    # cancella: un altro commentatore no, l'autore sì (e porta via le risposte)
    other = _tok(client, base, h, "commenter")
    assert client.delete(f"{base}/comments/{cid}", headers=other).status_code == 403
    assert client.delete(f"{base}/comments/{cid}", headers=com).status_code == 204
    assert client.get(f"{base}/comments?entity=activity&entity_id={aid}", headers=h).json() == []


def test_link_expiry_and_update(client, project):
    h, base = owner(), f"/projects/{project}"
    t = client.post(f"{base}/tokens", json={"person_name": "x", "role": "viewer", "expires_in_days": 3}, headers=h).json()
    assert t["expires_at"]
    auth = {"Authorization": f"Bearer {t['raw_token']}"}
    assert client.get(f"{base}/activities", headers=auth).status_code == 200
    with sqlite3.connect(os.environ["DB_PATH"]) as c:
        c.execute("UPDATE project_tokens SET expires_at = datetime('now', '-1 minute') WHERE id = ?", (t["id"],))
    assert client.get(f"{base}/activities", headers=auth).status_code == 401
    r = client.patch(f"{base}/tokens/{t['id']}", json={"role": "commenter", "no_expiry": True}, headers=h).json()
    assert r["role"] == "commenter" and r["expires_at"] is None
    assert client.get(f"{base}/activities", headers=auth).status_code == 200


def test_access_request_and_transfer(client, project):
    h, base = owner(), f"/projects/{project}"
    guest = owner("guest@x.it")
    assert client.get(f"{base}/activities", headers=guest).status_code == 403
    r = client.post(f"{base}/access-requests", json={"message": "Sono del reparto"}, headers=guest)
    assert r.status_code == 201
    assert client.post(f"{base}/access-requests", json={}, headers=guest).json()["id"] == r.json()["id"]  # niente doppioni
    assert client.post(f"{base}/access-requests", json={}, headers=h).status_code == 409  # l'owner ha già accesso
    assert client.get(f"{base}/access-requests", headers=guest).status_code == 403
    pending = client.get(f"{base}/access-requests", headers=h).json()
    assert [p["email"] for p in pending] == ["guest@x.it"]
    assert client.post(f"{base}/access-requests/{pending[0]['id']}/approve", json={"role": "commenter"}, headers=h).status_code == 200
    members = client.get(f"{base}/members", headers=h).json()
    assert [(m["email"], m["role"]) for m in members] == [("guest@x.it", "commenter")]
    assert client.get(f"{base}/access-requests", headers=h).json() == []
    # rifiuto
    rid = client.post(f"{base}/access-requests", json={}, headers=owner("g2@x.it")).json()["id"]
    assert client.post(f"{base}/access-requests/{rid}/reject", headers=h).status_code == 200
    # trasferimento: il nuovo è owner, il vecchio resta editor
    assert client.post(f"{base}/transfer", json={"email": "guest@x.it"}, headers=guest).status_code == 403
    assert client.post(f"{base}/transfer", json={"email": "guest@x.it"}, headers=h).status_code == 200
    assert client.get(f"{base}/tokens", headers=guest).status_code == 200
    assert client.get(f"{base}/tokens", headers=h).status_code == 403
    assert [(m["email"], m["role"]) for m in client.get(f"{base}/members", headers=guest).json()] == [("o@x.it", "editor")]


def test_old_database_gets_commenter_role(tmp_path):
    db = tmp_path / "old.db"
    with sqlite3.connect(db) as c:
        c.executescript(
            """
            CREATE TABLE projects (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, owner_email TEXT, start_date TEXT, end_date TEXT, created_at TEXT DEFAULT (datetime('now')));
            CREATE TABLE project_tokens (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
              token_hash TEXT NOT NULL UNIQUE, person_name TEXT NOT NULL, email TEXT, role TEXT NOT NULL CHECK (role IN ('editor','viewer')),
              revoked_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), last_used_at TEXT);
            CREATE TABLE members (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL, password_hash TEXT NOT NULL,
              must_change_password INTEGER NOT NULL DEFAULT 1, token_version INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')));
            CREATE TABLE project_members (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
              member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE, role TEXT NOT NULL CHECK (role IN ('editor','viewer')),
              created_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE (project_id, member_id));
            INSERT INTO projects (name, owner_email, start_date, end_date) VALUES ('P', 'o@x.it', '2026-07-01', '2026-07-02');
            INSERT INTO project_tokens (project_id, token_hash, person_name, role) VALUES (1, 'h1', 'Ada', 'viewer');
            INSERT INTO members (email, display_name, password_hash) VALUES ('m@x.it', 'Mia', 'x');
            INSERT INTO project_members (project_id, member_id, role) VALUES (1, 1, 'editor');
            """
        )
    code = (
        "from app.db import init_db, get_conn\n"
        "init_db(); init_db()\n"  # due avvii di fila: la seconda volta non deve rifare niente
        "with get_conn() as c:\n"
        "    c.execute(\"UPDATE project_tokens SET role='commenter'\")\n"
        "    c.execute(\"UPDATE project_members SET role='commenter'\")\n"
        "    print(tuple(c.execute('SELECT person_name, role, expires_at FROM project_tokens').fetchone()),\n"
        "          tuple(c.execute('SELECT member_id, role FROM project_members').fetchone()))\n"
    )
    out = subprocess.run(
        [sys.executable, "-c", code],
        capture_output=True,
        text=True,
        env={**os.environ, "DB_PATH": str(db), "PYTHONPATH": os.path.dirname(os.path.dirname(__file__))},
    )
    assert out.returncode == 0, out.stderr
    assert out.stdout.strip() == "('Ada', 'commenter', None) (1, 'commenter')"
