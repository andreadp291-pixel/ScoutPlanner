import os

os.environ.setdefault("SECRET_KEY", "test-secret")

from app.mail_html import to_html  # noqa: E402

TEXT = (
    "Ciao Mia,\n"
    "nel vademecum «Camp <b>» ti mancano ancora da compilare 2 attività:\n\n"
    "  • Pranzo — mer 1 lug, 12:00–13:00\n    https://x.it/#/projects/1/activities/5/description\n"
    "  • Cena — mer 1 lug, 19:00–20:00\n    https://x.it/#/projects/1/activities/6/description\n\n"
    "STATO DEL PROGETTO (solo per te)\n  • Mia: 1 fatte, 1 da fare, 0 in ritardo\n\n"
    "Apri il progetto: https://x.it/#/projects/1\n\n"
    "—\nNon vuoi più queste email? Gestiscile qui: https://x.it/#/account/email"
)


def test_email_html_look():
    html = to_html("Oggetto", TEXT)
    assert "#2c6a4a" in html and "ScoutPlanner" in html and 'src="cid:logo"' in html  # colori e logo dell'app
    assert html.count('href="https://x.it/#/projects/1/activities/') == 2  # un link per attività
    assert "Apri il progetto</a>" in html  # il link diventa un pulsante
    assert "STATO DEL PROGETTO" in html
    assert "&lt;b&gt;" in html and "<b>" not in html  # il testo viene escapato
    assert "Non vuoi più queste email?" in html and "account/email" in html


def test_email_html_background():
    html = to_html("Oggetto", TEXT, bg_url="https://x.it/email-bg.png")
    assert "url('https://x.it/email-bg.png')" in html and 'bgcolor="#f1f4ef"' in html  # curve di livello, con colore di riserva
    assert "url(" not in to_html("Oggetto", TEXT)


def test_email_html_without_logo():
    assert "cid:" not in to_html("Oggetto", "Ciao Mia,\nciao", logo_cid=None)


def test_message_has_text_html_and_inline_logo(monkeypatch):
    from app import mail

    sent = []

    class FakeSMTP:
        def __init__(self, *a, **k): ...
        def __enter__(self): return self
        def __exit__(self, *a): ...
        def login(self, *a): ...
        def send_message(self, msg): sent.append(msg)

    monkeypatch.setattr(mail, "SMTP_USER", "x@y.it")
    monkeypatch.setattr(mail, "SMTP_PASSWORD", "pw")
    monkeypatch.setattr(mail.smtplib, "SMTP_SSL", FakeSMTP)
    assert mail._send("a@b.it", "Oggetto", TEXT)
    msg = sent[0]
    assert msg.get_body(("plain",)).get_content().startswith("Ciao Mia,")  # chi non vede l'HTML legge il testo
    html_part = msg.get_body(("html",))
    assert "ScoutPlanner" in html_part.get_content() and "/email-bg.png" in html_part.get_content()
    assert [p.get_content_type() for p in msg.walk()].count("image/png") == 1  # logo incorporato (cid)
