# Deploy backend sul Raspberry Pi

## Prima volta

```bash
ssh andrea@192.168.1.139
cd ~
git clone https://github.com/andreadp291-pixel/ScoutPlanner.git
cd ScoutPlanner/backend
python3 -m venv venv
./venv/bin/pip install -r requirements.txt
cp .env.example .env
# Modifica .env: genera SECRET_KEY con
python3 -c "import secrets; print(secrets.token_hex(32))"
# e imposta SMTP_USER/SMTP_PASSWORD (stessi di /home/andrea/segnalazioni/.env)
```

## systemd unit

Crea `/etc/systemd/system/scoutplanner.service` con questo comando (heredoc, evita errori di copia-incolla in editor):

```bash
sudo tee /etc/systemd/system/scoutplanner.service > /dev/null <<'EOF'
[Unit]
Description=ScoutPlanner API
After=network.target

[Service]
Type=simple
User=andrea
WorkingDirectory=/home/andrea/ScoutPlanner/backend
EnvironmentFile=/home/andrea/ScoutPlanner/backend/.env
ExecStart=/home/andrea/ScoutPlanner/backend/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8093
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

## Esposizione via Tailscale Funnel

Aggiungi il nuovo path `/scoutplanner` alla configurazione Funnel esistente (senza toccare gli altri path già mappati su `/`, `/segnalazioni`, ecc.):

```bash
sudo tailscale serve --bg --set-path /scoutplanner http://127.0.0.1:8093
```

> ⚠️ **Attenzione**: questo comando (`tailscale serve --set-path`, senza `funnel`) può disattivare silenziosamente il flag `AllowFunnel` (accesso pubblico da internet) sulla porta 443, riportando `/` e `/segnalazioni` a "solo tailnet". Verifica sempre con `tailscale serve status --json` che `AllowFunnel` sia `true` per la porta 443 dopo ogni modifica. Se è sparito, ripristinalo con:
> ```bash
> sudo tailscale funnel --bg --set-path / http://127.0.0.1:8000
> ```
> (riabilita il Funnel pubblico senza rimuovere gli altri path già mappati).

Verifica con:

```bash
tailscale serve status --json   # controlla AllowFunnel per ogni porta
curl https://andrea.tail04be23.ts.net/scoutplanner/health
```

## Aggiornamenti successivi

```bash
ssh andrea@192.168.1.139
cd ~/ScoutPlanner
git pull
cd backend
./venv/bin/pip install -r requirements.txt
sudo systemctl restart scoutplanner.service
```

## Note

- Il database SQLite (`scoutplanner.db`) vive nella cartella `backend/` sul Pi — non è versionato in git, backuppalo periodicamente (es. `cp scoutplanner.db scoutplanner.db.bak`).
- `FRONTEND_ORIGIN` in `.env` deve essere esattamente `https://andreadp291-pixel.github.io` (senza path), altrimenti il CORS blocca le richieste dal frontend.
- `FRONTEND_BASE_URL` deve includere il path del repo (`https://andreadp291-pixel.github.io/ScoutPlanner`) perché è usato per costruire il link nel magic-link email.
