"""Crea sul server il progetto descritto da un piano (vedi import_vademecum.py). Solo libreria standard: gira anche sul Pi."""

import json
import urllib.request


def load(plan: dict, api: str, token: str) -> int:
    def call(method: str, path: str, body=None):
        req = urllib.request.Request(
            api.rstrip("/") + path, method=method, data=json.dumps(body).encode() if body is not None else None,
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read() or "null")

    pid = call("POST", "/projects", {k: plan[k] for k in ("name", "start_date", "end_date")})["id"]
    for g in plan["groups"]:
        call("POST", f"/projects/{pid}/groups", {"name": g})
    # chi non ha un account diventa «persona con link» (sola lettura): così può essere responsabile delle attività
    refs = {plan["owner_name"]: "o"}
    for name in plan["people"]:
        refs[name] = "t%d" % call("POST", f"/projects/{pid}/tokens", {"person_name": name, "role": "viewer"})["id"]
    for a in plan["activities"]:
        body = {"category": "attivita", **{k: v for k, v in a.items() if k != "assignee_names"}}
        body["assignees"] = [refs[n] for n in a["assignee_names"]]
        call("POST", f"/projects/{pid}/activities", body)
    for pg in plan["pages"]:
        call("POST", f"/projects/{pid}/pages", pg)
    for m in plan["materials"]:
        call("PUT", f"/projects/{pid}/materials", {
            "name": m["name"],
            "procure_ref": refs.get(m["procure"]) if m["procure"] else None,
            "transport_ref": refs.get(m["transport"]) if m["transport"] else None,
        })
    return pid
