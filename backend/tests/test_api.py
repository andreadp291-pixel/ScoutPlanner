import os
import tempfile

os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ["DB_PATH"] = os.path.join(tempfile.mkdtemp(), "test.db")
os.environ["UPLOADS_DIR"] = tempfile.mkdtemp()

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.routers import auth
from app.security import create_owner_session_token

ACT = {"title": "A", "category": "x", "color": "#fff", "start_at": "2026-07-01T09:00", "end_at": "2026-07-01T10:00"}


@pytest.fixture
def client():
    with TestClient(app) as c:
        auth._login_attempts.clear()
        yield c


def owner(email="o@x.it"):
    return {"Authorization": f"Bearer {create_owner_session_token(email, 0)}"}


@pytest.fixture
def project(client):
    r = client.post("/projects", json={"name": "P", "start_date": "2026-07-01", "end_date": "2026-07-05"}, headers=owner())
    return r.json()["id"]


def test_viewer_cannot_create_but_editor_can(client, project):
    h = owner()
    viewer = client.post(f"/projects/{project}/tokens", json={"person_name": "v", "role": "viewer"}, headers=h).json()["raw_token"]
    editor = client.post(f"/projects/{project}/tokens", json={"person_name": "e", "role": "editor"}, headers=h).json()
    url = f"/projects/{project}/activities"
    assert client.post(url, json=ACT, headers={"Authorization": f"Bearer {viewer}"}).status_code == 403
    assert client.post(url, json=ACT, headers={"Authorization": f"Bearer {editor['raw_token']}"}).status_code == 201
    client.delete(f"/projects/{project}/tokens/{editor['id']}", headers=h)
    assert client.get(url, headers={"Authorization": f"Bearer {editor['raw_token']}"}).status_code == 401


def test_other_owner_is_rejected(client, project):
    assert client.get(f"/projects/{project}/activities", headers=owner("altro@x.it")).status_code == 403


def test_overlap_and_time_validation(client, project):
    url, h = f"/projects/{project}/activities", owner()
    assert client.post(url, json=ACT, headers=h).status_code == 201
    assert client.post(url, json={**ACT, "start_at": "2026-07-01T09:30", "end_at": "2026-07-01T11:00"}, headers=h).status_code == 409
    assert client.post(url, json={**ACT, "start_at": "2026-07-02T10:00", "end_at": "2026-07-02T09:00"}, headers=h).status_code == 400
    assert client.post(url, json={**ACT, "start_at": "2026-07-02T22:00", "end_at": "2026-07-03T01:00"}, headers=h).status_code == 400
    assert client.post(url, json={**ACT, "start_at": "ciao"}, headers=h).status_code == 422


def test_patch_null_is_422_not_500(client, project):
    h = owner()
    aid = client.post(f"/projects/{project}/activities", json=ACT, headers=h).json()["id"]
    assert client.patch(f"/projects/{project}/activities/{aid}", json={"title": None}, headers=h).status_code == 422


def test_swap_keeps_group_ids(client, project):
    h, url = owner(), f"/projects/{project}/activities"
    g = client.post(f"/projects/{project}/groups", json={"name": "g"}, headers=h).json()["id"]
    a = client.post(url, json={**ACT, "group_ids": [g]}, headers=h).json()["id"]
    b = client.post(url, json={**ACT, "start_at": "2026-07-01T11:00", "end_at": "2026-07-01T12:00"}, headers=h).json()["id"]
    out = client.post(f"{url}/swap", json={"id_a": a, "id_b": b}, headers=h).json()
    assert {x["id"]: x["group_ids"] for x in out}[a] == [g]


def test_project_dates_validated(client, project):
    r = client.patch(f"/projects/{project}", json={"end_date": "2026-06-01"}, headers=owner())
    assert r.status_code == 400


def test_request_link_rate_limited(client):
    codes = [client.post("/auth/request-link", json={"email": "a@x.it"}).status_code for _ in range(9)]
    assert codes[:8] == [202] * 8 and codes[8] == 429


def test_owner_login_does_not_reveal_accounts(client):
    r = client.post("/auth/owner/login", json={"email": "mai@x.it", "password": "x"})
    assert r.status_code == 401 and r.json()["detail"] == "Credenziali non valide"


def test_upload_rejects_svg(client, project):
    r = client.post(f"/projects/{project}/uploads", files={"file": ("a.svg", b"<svg/>")}, headers=owner())
    assert r.status_code == 400


def test_poi_and_page_routers(client, project):
    h = owner()
    poi = client.post(f"/projects/{project}/pois", json={"kind": "hospital", "name": "H"}, headers=h)
    assert poi.status_code == 201
    pid = poi.json()["id"]
    assert client.patch(f"/projects/{project}/pois/{pid}", json={"name": None}, headers=h).status_code == 422
    assert client.patch(f"/projects/{project}/pois/{pid}", json={"lat": 1.5, "lon": 2.5}, headers=h).status_code == 200
    page = client.post(f"/projects/{project}/pages", json={"title": "T"}, headers=h)
    assert page.status_code == 201
    assert client.get(f"/projects/{project}/pages", headers=h).status_code == 200


def test_assignees_and_materials(client, project):
    h, url = owner(), f"/projects/{project}/activities"
    link = client.post(f"/projects/{project}/tokens", json={"person_name": "Silvia", "role": "editor"}, headers=h).json()
    people = client.get(f"/projects/{project}/people", headers=h).json()
    refs = {p["name"]: p["ref"] for p in people}
    assert refs["Silvia"] == f"t{link['id']}" and refs["o@x.it"] == "o"

    a = client.post(url, json={**ACT, "assignees": [refs["Silvia"], "t999", refs["Silvia"]], "materials": "Corda, torcia\ncorda"}, headers=h).json()
    assert a["assignees"] == [refs["Silvia"]]  # persone sconosciute e doppioni scartati
    b = client.post(url, json={**ACT, "start_at": "2026-07-01T11:00", "end_at": "2026-07-01T12:00", "materials": "Torcia"}, headers=h).json()
    assert client.patch(f"{url}/{b['id']}", json={"assignees": []}, headers=h).json()["assignees"] == []

    mats = client.get(f"/projects/{project}/materials", headers=h).json()
    assert [m["key"] for m in mats] == ["corda", "torcia"]
    assert len(mats[1]["activities"]) == 2

    r = client.put(f"/projects/{project}/materials", json={"name": "Corda", "procure_ref": refs["Silvia"], "transport_ref": "o"}, headers=h)
    assert r.status_code == 200
    assert client.get(f"/projects/{project}/materials", headers=h).json()[0]["procure_ref"] == refs["Silvia"]
    assert client.put(f"/projects/{project}/materials", json={"name": "Corda", "procure_ref": "m999"}, headers=h).status_code == 400

    # chi ha il link è riconosciuto: access restituisce il suo ref
    me = client.get(f"/projects/{project}/access", headers={"Authorization": f"Bearer {link['raw_token']}"}).json()
    assert me["ref"] == refs["Silvia"]


def test_google_login(client, project, monkeypatch):
    monkeypatch.setattr(auth, "GOOGLE_CLIENT_ID", "cid")
    h = owner()
    client.post(f"/projects/{project}/members", json={"person_name": "Mia", "email": "mia@x.it", "role": "editor"}, headers=h)
    fake = {"good": {"email": "mia@x.it", "name": "Mia"}, "new": {"email": "nuovo@x.it", "name": "N"}}
    monkeypatch.setattr(auth, "verify_google_access_token", lambda cred, cid: fake.get(cred))

    r = client.post("/auth/google", json={"access_token": "good"}).json()
    assert r["member"]["must_change_password"] is False and r["owner_projects"] == 0
    # la sessione membro ottenuta con Google apre il progetto, anche se la password provvisoria non era stata cambiata
    tok = r["member"]["session_token"]
    assert client.get(f"/projects/{project}/activities", headers={"Authorization": f"Bearer {tok}"}).status_code == 200

    new = client.post("/auth/google", json={"access_token": "new"}).json()
    assert new["member"] is None and new["owner"]["email"] == "nuovo@x.it"
    assert client.post("/auth/google", json={"access_token": "falso"}).status_code == 401


def test_google_login_disabled_without_client_id(client, monkeypatch):
    monkeypatch.setattr(auth, "GOOGLE_CLIENT_ID", "")
    assert client.post("/auth/google", json={"access_token": "x"}).status_code == 503


def test_verify_google_access_token_checks_audience(monkeypatch):
    import io
    import json as _json

    from app import security

    def fake_urlopen(url, timeout):
        return io.StringIO(_json.dumps(payload))

    monkeypatch.setattr(security.urllib.request, "urlopen", fake_urlopen)
    payload = {"aud": "cid", "email": "A@X.it", "email_verified": "true"}
    assert security.verify_google_access_token("t", "cid") == {"email": "a@x.it"}
    assert security.verify_google_access_token("t", "altro-client") is None  # token emesso per un'altra app
    payload["email_verified"] = "false"
    assert security.verify_google_access_token("t", "cid") is None


def test_history_trash_and_restore(client, project):
    h, base = owner(), f"/projects/{project}"
    aid = client.post(f"{base}/activities", json=ACT, headers=h).json()["id"]
    client.patch(f"{base}/activities/{aid}", json={"title": "B"}, headers=h)
    client.patch(f"{base}/activities/{aid}", json={"title": "B"}, headers=h)  # nessun cambiamento: non va nel log
    hist = client.get(f"{base}/history", headers=h).json()
    assert [e["action"] for e in hist] == ["update", "create"] and hist[0]["restorable"] and not hist[1]["restorable"]
    # ripristina la versione precedente
    assert client.post(f"{base}/history/{hist[0]['id']}/restore", headers=h).status_code == 200
    assert client.get(f"{base}/activities/{aid}", headers=h).json()["title"] == "A"
    # cestino: sparisce dalla lista, si recupera, si elimina per sempre
    assert client.delete(f"{base}/activities/{aid}", headers=h).status_code == 204
    assert client.get(f"{base}/activities", headers=h).json() == []
    assert client.get(f"{base}/activities/{aid}", headers=h).status_code == 404
    assert client.get(f"{base}/trash", headers=h).json()[0]["id"] == aid
    # nel cestino non occupa l'orario
    other = client.post(f"{base}/activities", json=ACT, headers=h).json()["id"]
    assert client.post(f"{base}/trash/activity/{aid}/restore", headers=h).status_code == 409
    client.delete(f"{base}/activities/{other}", headers=h)
    assert client.post(f"{base}/trash/activity/{aid}/restore", headers=h).status_code == 200
    assert [a["id"] for a in client.get(f"{base}/activities", headers=h).json()] == [aid]
    client.delete(f"{base}/activities/{aid}", headers=h)
    assert client.delete(f"{base}/trash/activity/{aid}", headers=h).status_code == 204
    assert all(i["id"] != aid for i in client.get(f"{base}/trash", headers=h).json())
    # pagine: stesso schema
    pid = client.post(f"{base}/pages", json={"title": "P1", "content": "x"}, headers=h).json()["id"]
    client.delete(f"{base}/pages/{pid}", headers=h)
    assert client.get(f"{base}/pages", headers=h).json() == []
    assert client.post(f"{base}/trash/page/{pid}/restore", headers=h).status_code == 200
    # il viewer vede la cronologia ma non ripristina
    v = client.post(f"{base}/tokens", json={"person_name": "v", "role": "viewer"}, headers=h).json()["raw_token"]
    vh = {"Authorization": f"Bearer {v}"}
    assert client.get(f"{base}/history", headers=vh).status_code == 200
    assert client.post(f"{base}/trash/page/{pid}/restore", headers=vh).status_code == 403
