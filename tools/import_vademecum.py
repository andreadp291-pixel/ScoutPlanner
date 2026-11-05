"""Legge il vademecum Word del campo (tabelle orarie, dettaglio per attività, pagine generali) e ne fa un progetto.

Uso:
  python tools/import_vademecum.py FILE.docx --json out.json        # solo anteprima dei dati
  python tools/import_vademecum.py FILE.docx --api URL --token TOKEN    # crea il progetto sul server (token = sessione del proprietario)

Cosa diventa cosa:
  tabella oraria di ogni giorno -> attività (righe consecutive uguali unite), con «Chi» e «Materiali»
  paragrafi sotto «7:00 Titolo»  -> descrizione dell'attività che inizia a quell'ora
  sezioni generali (Camere, ...) -> pagine del progetto; Sestiglie -> anche gruppi
Le immagini del Word non vengono importate.
"""

import argparse
import json
import re
import secrets
import sys

from docx import Document
from docx.table import Table
from docx.text.paragraph import Paragraph

YEAR, MONTH = 2024, 7  # il campo dom 21 – dom 28 luglio 2024 (21 luglio 2024 è una domenica)
URL = re.compile(r"^https?://\S+$")
COLORS = [  # per parole chiave nel titolo: pasti, fuoco, spiritualità, ...
    (("colazione", "merenda", "pranzo", "cena"), "#d98a1f"),
    (("fuoco",), "#d4572b"),
    (("catechesi", "messa", "preghiera"), "#7a5fb3"),
    (("sveglia", "ula ula"), "#8a9a2f"),
    (("siesta", "servizi", "docce", "camere", "pulizie"), "#5b86a8"),
]


def bid() -> str:
    return secrets.token_hex(4)


def color_for(title: str) -> str:
    low = title.lower()
    return next((c for keys, c in COLORS if any(k in low for k in keys)), "#3f8f5f")


def hhmm(minutes: int) -> str:
    return f"{minutes // 60:02d}:{minutes % 60:02d}"


def cell_texts(row, repeat_merged: bool) -> list[str]:
    out, seen = [], set()
    for c in row.cells:
        if not repeat_merged and id(c._tc) in seen:
            continue
        seen.add(id(c._tc))
        t = c.text.strip()
        out.append("" if t == "/" else t)
    return out


def body_items(doc: Document):
    for el in doc.element.body.iterchildren():
        if el.tag.endswith("}p"):
            p = Paragraph(el, doc)
            if p.text.strip():
                yield "p", p
        elif el.tag.endswith("}tbl"):
            yield "t", Table(el, doc)


def text_blocks(items) -> list[dict]:
    """Paragrafi -> blocchi: elenchi consecutivi in un solo blocco, link soli come link."""
    blocks, bullets = [], []

    def flush():
        nonlocal bullets
        if bullets:
            blocks.append({"id": bid(), "type": "list", "items": bullets})
            bullets = []

    for kind, obj in items:
        if kind == "bullet":
            bullets.append(obj)
            continue
        flush()
        if kind == "text":
            blocks.append({"id": bid(), "type": "link", "url": obj, "label": obj} if URL.match(obj) else {"id": bid(), "type": "text", "text": obj})
        elif kind == "title":
            blocks.append({"id": bid(), "type": "title", "text": obj})
        elif kind == "table":
            blocks.append({"id": bid(), "type": "table", "rows": obj})
    flush()
    return blocks


def classify(p: Paragraph):
    s = p.style.name
    if s.startswith("Heading"):
        return "title", p.text.strip()
    if s == "List Paragraph":
        return "bullet", p.text.strip()
    return "text", p.text.strip()


def clean_table(t: Table) -> list[str] | list[list[str]]:
    rows = [cell_texts(r, repeat_merged=True) for r in t.rows]
    rows = [r for r in rows if any(r)]
    width = max(len(r) for r in rows)
    return [r + [""] * (width - len(r)) for r in rows]


def parse_day_table(t: Table):
    """-> (data ISO, [dict(title, chi, materials, start, end)])"""
    head = cell_texts(t.rows[0], repeat_merged=False)
    day = int(re.search(r"(\d+)\s*$", head[1]).group(1))
    rows = []
    for r in t.rows[1:]:
        c = cell_texts(r, repeat_merged=False)
        m = re.match(r"(\d+):(\d+)$", c[0]) if c else None
        if not m or len(c) < 2 or not c[1]:
            continue
        rows.append((int(m.group(1)) * 60 + int(m.group(2)), *(c[1:4] + [""] * (3 - len(c[1:4])))))
    acts = []
    for start, full, chi, mat in rows:
        title, *extra = [x.strip() for x in full.split("\n") if x.strip()]  # «Colazione / Biscotti Nico»: la seconda riga va nei dettagli
        if acts and acts[-1]["key"] == (full, chi, mat) and acts[-1]["end"] == start:
            acts[-1]["end"] = start + 30
        else:
            acts.append({"key": (full, chi, mat), "title": title, "extra": extra, "chi": chi, "materials": mat, "start": start, "end": start + 30})
    return f"{YEAR}-{MONTH:02d}-{day:02d}", acts


def build(path: str) -> dict:
    doc = Document(path)
    project = {"name": "", "subtitle": ""}
    pages: list[dict] = []
    days: dict[str, dict] = {}
    section = None  # ("page", titolo, items) | ("day", None)
    cur_day = None
    cur_detail: list = []  # [titolo-sezione, items]
    first = True
    for kind, obj in body_items(doc):
        style = obj.style.name if kind == "p" else ""
        if kind == "p" and first and style in ("No Spacing", "Title"):
            project["name"] = obj.text.strip()
            continue
        if kind == "p" and style == "Subtitle":
            project["subtitle"] = (project["subtitle"] + " " + obj.text.strip()).strip()
            continue
        first = False
        if kind == "p" and style == "Heading 1":
            title = obj.text.strip()
            if re.match(r"(Luned|Marted|Mercoled|Gioved|Venerd|Sabato|Domenica)", title):
                section, cur_day = ("day",), None
            else:
                section = ("page", title, [])
                pages.append({"title": title, "items": section[2]})
            continue
        if kind == "p" and re.match(r"(Luned|Marted|Mercoled|Gioved|Venerd)\S*\s+\d+$", obj.text.strip()):
            section, cur_day = ("day",), None  # titolo del giorno senza stile (es. «Martedì 23»)
            continue
        if section is None:
            continue
        if section[0] == "page":
            if kind == "t":
                section[2].append(("table", clean_table(obj)))
            else:
                k, text = classify(obj)
                section[2].append((k, text))
            continue
        # giorno
        if kind == "t":
            date, acts = parse_day_table(obj)
            cur_day = days.setdefault(date, {"date": date, "acts": acts, "details": []})
            cur_detail = None
            continue
        if cur_day is None:
            continue
        k, text = classify(obj)
        if k == "title":
            if text.lower().startswith("tabella"):
                continue
            m = re.match(r"(\d+):(\d+)\s+(.*)", text)
            cur_detail = {"at": int(m.group(1)) * 60 + int(m.group(2)) if m else None, "title": text, "items": []}
            cur_day["details"].append(cur_detail)
        elif cur_detail is not None:
            cur_detail["items"].append((k, text))

    activities = []
    for date in sorted(days):
        d = days[date]
        for a in d["acts"]:
            items = []
            if a["chi"]:
                items.append(("text", "Chi: " + re.sub(r"\s*\n\s*", ", ", a["chi"])))
            items += [("text", e) for e in a["extra"]]
            for det in d["details"]:
                if det["at"] == a["start"]:
                    items += det["items"]
            activities.append({"date": date, **{k: a[k] for k in ("title", "start", "end", "materials")}, "items": items})
        # sezioni senza ora (es. «Preparazione alla partenza»): sulla prima attività del giorno con un titolo
        for det in d["details"]:
            if det["at"] is None and activities:
                first_act = next(x for x in activities if x["date"] == date and x["title"])
                first_act["items"] = [("title", det["title"])] + det["items"] + first_act["items"]
            elif det["at"] is not None and not any(x["date"] == date and x["start"] == det["at"] for x in activities):
                owner = next((x for x in activities if x["date"] == date and x["start"] <= det["at"] < x["end"]), None)
                if owner:
                    owner["items"] += [("title", det["title"])] + det["items"]
    dates = sorted(days)
    groups = []
    for pg in pages:
        if pg["title"].lower().startswith("sestigl"):
            groups = [t for k, t in pg["items"] if k == "title"]
    return {
        "name": project["subtitle"] or project["name"],
        "start_date": dates[0],
        "end_date": dates[-1],
        "groups": groups,
        "activities": [
            {
                "title": a["title"],
                "start_at": f"{a['date']}T{hhmm(a['start'])}",
                "end_at": f"{a['date']}T{hhmm(a['end'])}",
                "color": color_for(a["title"]),
                "materials": re.sub(r"\s*\n\s*", ", ", a["materials"]),
                "description": json.dumps({"blocks": text_blocks(a["items"])}, ensure_ascii=False) if a["items"] else "",
            }
            for a in activities
        ],
        "pages": [{"title": pg["title"], "content": json.dumps({"blocks": text_blocks(pg["items"])}, ensure_ascii=False)} for pg in pages],
    }


def load(plan: dict, api: str, token: str) -> int:
    import urllib.request

    def call(method: str, path: str, body=None):
        req = urllib.request.Request(
            api.rstrip("/") + path, method=method, data=json.dumps(body).encode() if body is not None else None,
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read() or "null")

    pid = call("POST", "/projects", {"name": plan["name"], "start_date": plan["start_date"], "end_date": plan["end_date"]})["id"]
    for g in plan["groups"]:
        call("POST", f"/projects/{pid}/groups", {"name": g})
    for a in plan["activities"]:
        call("POST", f"/projects/{pid}/activities", {"category": "attivita", **a})
    for pg in plan["pages"]:
        call("POST", f"/projects/{pid}/pages", pg)
    return pid


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("docx")
    ap.add_argument("--json")
    ap.add_argument("--api")
    ap.add_argument("--token")
    a = ap.parse_args()
    plan = build(a.docx)
    print(f"{plan['name']}: {plan['start_date']} - {plan['end_date']}, {len(plan['groups'])} gruppi, {len(plan['activities'])} attività, {len(plan['pages'])} pagine")
    if a.json:
        open(a.json, "w", encoding="utf8").write(json.dumps(plan, ensure_ascii=False, indent=1))
    if a.api:
        print("creato progetto", load(plan, a.api, a.token), file=sys.stderr)
