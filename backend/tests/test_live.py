import time

from test_api import ACT, client, owner, project  # noqa: F401  (fixture e helper condivisi)

from app.routers import live


def _link(client, base, h, name, role="editor"):
    return {"Authorization": "Bearer " + client.post(f"{base}/tokens", json={"person_name": name, "role": role}, headers=h).json()["raw_token"]}


def test_presence(client, project):
    h, base = owner(), f"/projects/{project}"
    ada = _link(client, base, h, "Ada")
    assert client.post(f"{base}/presence", json={"place": "project"}, headers=h).json() == []
    others = client.post(f"{base}/presence", json={"place": "activity:7", "editing": True}, headers=ada).json()
    assert [(o["ref"], o["place"], o["editing"]) for o in others] == [("o", "project", False)]
    assert client.post(f"{base}/presence", json={"place": "project"}, headers=h).json()[0]["name"] == "Ada"
    assert client.post(f"{base}/presence", json={"place": "boh"}, headers=h).status_code == 422
    # chi non si fa sentire sparisce
    for v in live._presence[project].values():
        v["seen"] = time.time() - live.PRESENCE_TTL - 1
    assert client.post(f"{base}/presence", json={"place": "project"}, headers=h).json() == []


def test_notifications_bell(client, project):
    h, base = owner(), f"/projects/{project}"
    ada = _link(client, base, h, "Ada")
    ada_ref = client.get(f"{base}/access", headers=ada).json()["ref"]
    first = client.get(f"{base}/notifications", headers=ada).json()  # primo accesso: parte da zero
    assert first["unread"] == 0
    aid = client.post(f"{base}/activities", json={**ACT, "assignees": [ada_ref]}, headers=h).json()["id"]
    client.patch(f"{base}/activities/{aid}", json={"title": "Nuovo"}, headers=h)
    client.post(f"{base}/comments", json={"entity": "activity", "entity_id": aid, "body": "Ciao a tutti"}, headers=h)
    n = client.get(f"{base}/notifications", headers=ada).json()
    assert n["unread"] == 4 and n["latest_id"] > first["latest_id"]  # creata, assegnata a lei, modificata, commentata
    assert {i["action"] for i in n["items"]} == {"create", "assign", "update", "comment"}
    # l'assegnazione è solo sua: per l'owner non c'è, e le sue stesse azioni non lo avvisano
    assert client.get(f"{base}/notifications", headers=h).json()["unread"] == 0
    assert all(i["action"] != "assign" for i in client.get(f"{base}/history", headers=h).json())
    assert client.post(f"{base}/notifications/read", headers=ada).status_code == 200
    n = client.get(f"{base}/notifications", headers=ada).json()
    assert n["unread"] == 0 and not any(i["unread"] for i in n["items"])
    # le sue azioni non la avvisano
    client.patch(f"{base}/activities/{aid}", json={"location": "Prato"}, headers=ada)
    assert client.get(f"{base}/notifications", headers=ada).json()["unread"] == 0
    assert client.get(f"{base}/notifications", headers=h).json()["unread"] == 1


def test_edit_conflict(client, project):
    h, base = owner(), f"/projects/{project}"
    ada = _link(client, base, h, "Ada")
    a = client.post(f"{base}/activities", json=ACT, headers=h).json()
    loaded = a["updated_at"]
    import sqlite3, os

    def bump(table, rid):  # un'altra persona salva: updated_at cambia (qui si forza, il secondo è troppo lento per i test)
        with sqlite3.connect(os.environ["DB_PATH"]) as c:
            c.execute(f"UPDATE {table} SET updated_at = '2000-01-01 00:00:00' WHERE id = ?", (rid,))

    # stessa versione: passa
    assert client.patch(f"{base}/activities/{a['id']}", json={"title": "B", "if_updated_at": loaded}, headers=ada).status_code == 200
    bump("activities", a["id"])
    r = client.patch(f"{base}/activities/{a['id']}", json={"title": "C", "if_updated_at": loaded}, headers=h)
    assert r.status_code == 409 and "Modifica in conflitto" in r.json()["detail"] and "Ada" in r.json()["detail"]
    assert client.get(f"{base}/activities/{a['id']}", headers=h).json()["title"] == "B"
    # senza if_updated_at si sovrascrive (è la scelta "salva comunque")
    assert client.patch(f"{base}/activities/{a['id']}", json={"title": "C"}, headers=h).status_code == 200
    # pagine
    p = client.post(f"{base}/pages", json={"title": "P", "content": "x"}, headers=h).json()
    bump("project_pages", p["id"])
    assert client.patch(f"{base}/pages/{p['id']}", json={"title": "Q", "if_updated_at": p["updated_at"]}, headers=ada).status_code == 409
    assert client.patch(f"{base}/pages/{p['id']}", json={"title": "Q"}, headers=ada).status_code == 200
