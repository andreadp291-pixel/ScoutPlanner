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
