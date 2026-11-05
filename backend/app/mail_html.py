"""Veste di grafica ScoutPlanner il testo semplice delle email (stessi colori e stile dell'app).

Il testo resta la fonte: qui si riconoscono poche forme (saluto, titoli di sezione in maiuscolo, elenchi puntati con
link, righe «Apri…: link») e le si disegna. Tutto ciò che arriva nel testo viene escapato.
"""

import html
import re

# colori dell'app (tema chiaro)
GREEN = "#2c6a4a"
GREEN_SOFT = "#dcebe2"
BG = "#f1f4ef"
INK = "#14261c"
MUTED = "#5d6e63"
LINE = "#d9dfd6"
FONT = "'Segoe UI', Helvetica, Arial, sans-serif"

_URL = re.compile(r"https?://\S+")
_CTA = re.compile(r"^([^:]{3,40}): (https?://\S+)$")


def _e(text: str) -> str:
    return html.escape(text, quote=True)


def _is_heading(line: str) -> bool:
    head = re.split(r"[—(]", line, maxsplit=1)[0].strip()
    return len(head) > 5 and head.upper() == head and any(c.isalpha() for c in head)


def _button(label: str, url: str) -> str:
    return (
        f'<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 6px"><tr>'
        f'<td style="background:{GREEN};border-radius:99px"><a href="{_e(url)}" '
        f'style="display:inline-block;padding:13px 26px;color:#ffffff;font:700 15px {FONT};text-decoration:none">'
        f"{_e(label)}</a></td></tr></table>"
    )


def _bullets(items: list[tuple[str, str | None]]) -> str:
    rows = []
    for text, url in items:
        title, sep, rest = text.partition(" — ")
        line = f'<strong style="color:{INK}">{_e(title)}</strong>' + (f'<span style="color:{MUTED}"> — {_e(rest)}</span>' if sep else "")
        if url:
            line = f'<a href="{_e(url)}" style="color:{INK};text-decoration:none">{line}</a>'
        rows.append(
            f'<tr><td style="padding:10px 14px;border-top:1px solid {LINE};font:15px/1.4 {FONT};color:{INK}">'
            f'<span style="color:{GREEN};font-weight:700">●</span>&nbsp; {line}</td></tr>'
        )
    return (
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        f'style="margin:6px 0 14px;border:1px solid {LINE};border-top:0;border-radius:14px;background:#ffffff">'
        + "".join(rows)
        + "</table>"
    )


def to_html(subject: str, text: str, logo_cid: str | None = "logo", bg_url: str | None = None) -> str:
    lines = text.split("\n")
    out: list[str] = []
    bullets: list[tuple[str, str | None]] = []
    footer: list[str] = []

    def flush():
        nonlocal bullets
        if bullets:
            out.append(_bullets(bullets))
            bullets = []

    i = 0
    while i < len(lines):
        line = lines[i].rstrip()
        i += 1
        if line.strip() == "—":  # il resto è il piè di pagina
            footer = [ln.strip() for ln in lines[i:] if ln.strip()]
            break
        if not line.strip():
            continue
        if line.startswith("  • "):
            url = None
            if i < len(lines) and lines[i].startswith("    http"):
                url = lines[i].strip()
                i += 1
            bullets.append((line[4:].strip(), url))
            continue
        flush()
        if _is_heading(line):
            out.append(f'<h2 style="margin:24px 0 8px;font:800 13px {FONT};letter-spacing:.06em;color:{GREEN}">{_e(line)}</h2>')
        elif line.endswith(":") and len(line) < 30 and i < len(lines) and lines[i].startswith("  "):
            out.append(f'<h3 style="margin:16px 0 4px;font:700 15px {FONT};color:{INK}">{_e(line[:-1])}</h3>')
        elif (m := _CTA.match(line.strip())) and line.strip().split(" ")[0] in ("Apri", "Rispondi", "Accedi"):
            out.append(_button(m.group(1), m.group(2)))
        elif _URL.fullmatch(line.strip()):
            out.append(_button("Apri il link", line.strip()))
        elif line.startswith("Ciao ") and line.endswith(","):
            out.append(f'<p style="margin:0 0 12px;font:700 20px {FONT};color:{INK}">{_e(line)}</p>')
        else:
            out.append(f'<p style="margin:0 0 12px;font:15px/1.55 {FONT};color:{INK}">{_e(line).replace(chr(10), "<br>")}</p>')
    flush()

    foot = ""
    if footer:
        parts = []
        for ln in footer:
            m = _URL.search(ln)
            if m:
                parts.append(f'{_e(ln[:m.start()])}<a href="{_e(m.group())}" style="color:{GREEN}">{_e(m.group())}</a>')
            else:
                parts.append(_e(ln))
        foot = f'<p style="margin:26px 0 0;padding-top:14px;border-top:1px solid {LINE};font:12px/1.5 {FONT};color:{MUTED}">' + "<br>".join(parts) + "</p>"

    logo = f'<img src="cid:{logo_cid}" width="34" height="34" alt="" style="display:block;border-radius:9px">' if logo_cid else ""
    # sfondo a curve di livello come nell'app: immagine ospitata sul sito (dove manca resta il colore pieno)
    bg_attr = f' background="{_e(bg_url)}"' if bg_url else ""
    bg_style = f"background:{BG} url('{_e(bg_url)}') no-repeat right top" if bg_url else f"background:{BG}"
    return f"""<!doctype html>
<html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{_e(subject)}</title></head>
<body style="margin:0;padding:0;background:{BG}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="{BG}"{bg_attr} style="{bg_style}"><tr><td align="center" style="padding:24px 12px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px">
    <tr><td style="background:{GREEN};border-radius:20px 20px 0 0;padding:20px 24px">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="padding-right:12px">{logo}</td>
        <td style="font:800 22px {FONT};color:#ffffff;letter-spacing:-.01em">ScoutPlanner</td>
      </tr></table>
      <div style="margin-top:6px;font:14px {FONT};color:#cfe3d6">Il vademecum del campo, scritto insieme.</div>
    </td></tr>
    <tr><td style="background:#ffffff;border:1px solid {LINE};border-top:0;border-radius:0 0 20px 20px;padding:26px 24px 24px">
      {''.join(out)}
      {foot}
    </td></tr>
  </table>
</td></tr></table>
</body></html>"""
