# Deploy del backend su un server Linux

Esempio con systemd. Va bene qualsiasi macchina Linux con Python 3.11+ (un Raspberry Pi basta e avanza).
Il database è un file SQLite: niente altro da installare.

## Prima volta

```bash
ssh UTENTE@INDIRIZZO-DEL-SERVER
cd ~
git clone https://github.com/andreadp291-pixel/ScoutPlanner.git
cd ScoutPlanner/backend
python3 -m venv venv
./venv/bin/pip install -r requirements.txt
cp .env.example .env
# Modifica .env: genera SECRET_KEY con
python3 -c "import secrets; print(secrets.token_hex(32))"
# e imposta SMTP_USER / SMTP_PASSWORD (account Gmail con password per le app) per le email
```

Variabili principali di `.env` (vedi `.env.example`):

| Variabile | A cosa serve |
|---|---|
| `SECRET_KEY` | firma delle sessioni, obbligatoria |
| `SMTP_USER`, `SMTP_PASSWORD` | invio email (link di accesso, inviti, notifiche, promemoria). Senza, le email finiscono nel log e i promemoria automatici non partono |
| `GOOGLE_CLIENT_ID` | attiva «Continua con Google» (valore pubblico, niente segreto) |
| `FRONTEND_ORIGIN` | origine del frontend per il CORS, senza path (es. `https://UTENTE.github.io`) |
| `FRONTEND_BASE_URL` | indirizzo completo del frontend, con il path del repo: serve ai link nelle email |
| `DB_PATH`, `UPLOADS_DIR` | dove tenere database e file caricati |

## systemd

Crea `/etc/systemd/system/scoutplanner.service` (sostituisci `UTENTE` con l'utente che esegue il servizio):

```bash
sudo tee /etc/systemd/system/scoutplanner.service > /dev/null <<'EOF'
[Unit]
Description=ScoutPlanner API
After=network.target

[Service]
Type=simple
User=UTENTE
WorkingDirectory=/home/UTENTE/ScoutPlanner/backend
EnvironmentFile=/home/UTENTE/ScoutPlanner/backend/.env
ExecStart=/home/UTENTE/ScoutPlanner/backend/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8093
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now scoutplanner.service
sudo systemctl status scoutplanner.service
```

## Renderlo raggiungibile da internet

Il servizio ascolta solo su `127.0.0.1:8093`. Per usarlo dal frontend serve un indirizzo HTTPS pubblico che
inoltri a quella porta: un reverse proxy (nginx, Caddy), un tunnel (Cloudflare Tunnel, Tailscale Funnel…) o
quello che usi già. Il frontend lo cerca in `VITE_API_BASE` (file `frontend/.env.production`).

Verifica:

```bash
curl https://TUO-INDIRIZZO/scoutplanner/health   # {"status":"ok"}
```

## Aggiornamenti successivi

```bash
ssh UTENTE@INDIRIZZO-DEL-SERVER
cd ~/ScoutPlanner
git pull
cd backend
./venv/bin/pip install -r requirements.txt
sudo systemctl restart scoutplanner.service
```

Le modifiche al database (nuove colonne e tabelle) si applicano da sole all'avvio.

## Note

- Il database SQLite (`scoutplanner.db`) vive nella cartella `backend/` e non è versionato: fanne una copia prima di
  ogni aggiornamento importante (`sqlite3 scoutplanner.db ".backup scoutplanner.db.bak"`).
- Il backend usa un solo processo: la presenza «chi c'è adesso» è tenuta in memoria. Con più processi servirebbe
  una tabella condivisa.
- `FRONTEND_ORIGIN` deve combaciare esattamente con l'origine del frontend, altrimenti il CORS blocca le richieste.
