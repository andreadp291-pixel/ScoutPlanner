# ScoutPlanner

App per creare in coworking i vademecum (programmi orari) di campi e uscite scout.

- Un capo crea un progetto con la propria email (magic link, niente password) e imposta le date di inizio/fine campo.
- Sul calendario del progetto si creano attività con orari a precisione di 1 minuto (titolo, descrizione, luogo, categoria/colore).
- Il progetto si condivide con altri capi via token (nessun account richiesto), con ruolo editor o sola lettura, gestibili dal menu "Gestisci persone".

## Struttura

- `frontend/` — React + Vite, deploy statico su GitHub Pages
- `backend/` — FastAPI + SQLite, deploy sul Raspberry Pi dietro Tailscale Funnel (vedi [docs/deployment.md](docs/deployment.md))

## Sviluppo locale

Backend:
```bash
cd backend
python -m venv venv
./venv/Scripts/pip install -r requirements.txt   # Windows; su Linux/Mac: venv/bin/pip
cp .env.example .env   # imposta SECRET_KEY
./venv/Scripts/python -m uvicorn app.main:app --reload --port 8093
```

Frontend:
```bash
cd frontend
npm install
npm run dev
```
