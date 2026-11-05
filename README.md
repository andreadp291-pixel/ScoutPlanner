<div align="center">

<img src="docs/img/banner.svg" alt="ScoutPlanner" width="100%">

<br>

[![Apri l'app](https://img.shields.io/badge/🏕️_Apri_l'app-2c6a4a?style=for-the-badge)](https://andreadp291-pixel.github.io/ScoutPlanner/)
[![Deploy frontend](https://img.shields.io/github/actions/workflow/status/andreadp291-pixel/ScoutPlanner/deploy-frontend.yml?style=for-the-badge&label=deploy&logo=github&color=2c6a4a)](https://github.com/andreadp291-pixel/ScoutPlanner/actions)

![React](https://img.shields.io/badge/React_19-20232a?style=flat-square&logo=react&logoColor=61dafb)
![Vite](https://img.shields.io/badge/Vite-646cff?style=flat-square&logo=vite&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?style=flat-square&logo=typescript&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003b57?style=flat-square&logo=sqlite&logoColor=white)
![Raspberry Pi](https://img.shields.io/badge/Raspberry_Pi-c51a4a?style=flat-square&logo=raspberrypi&logoColor=white)

**Il vademecum del campo, scritto insieme.**
Orari al minuto, materiali, mappe e contatti in un solo posto, per tutta la comunità capi.

</div>

---

## ✨ Cosa fa

| | |
|---|---|
| 📅 **Calendario** | Attività con orari a precisione di 1 minuto, categorie e colori. Si trascinano, si ridimensionano, si scambiano. |
| 👥 **Gruppi e persone** | Gruppi (squadriglie, branchi…) e assegnazione delle attività alle persone del progetto, con filtro «solo le mie». |
| 🧰 **Materiali** | Lista unica generata dai materiali delle attività, con chi li procura e chi li trasporta. |
| 🗺️ **Mappe e GPX** | Luogo del campo, punti di interesse (ospedale, farmacia, vigili del fuoco…) e tracce GPX con profilo altimetrico. |
| 📝 **Pagine** | Pagine libere a blocchi: titoli, testo, tabelle, immagini, percorsi e tempi di viaggio. |
| 🔗 **Condivisione** | Inviti con email e password personale, oppure link anonimi, con ruolo *editor* o *sola lettura*. |
| 🔑 **Accesso** | Link magico via email, password, oppure **Continua con Google**. |
| 📱 **Telefono** | Un giorno per volta a tutta larghezza, barra di schede in basso, finestre che salgono dal basso. Pensato per consultarlo sul campo. |
| 🌙 **Tema scuro** | Chiaro e scuro, con le curve di livello nello sfondo. |

## 🖼️ Com'è fatta

<div align="center">

<img src="docs/img/login.png" alt="Accesso" width="85%">

<br><br>

<img src="docs/img/calendario-desktop.png" alt="Calendario su computer" width="85%">

<br><br>

<img src="docs/img/calendario-telefono.png" alt="Calendario su telefono" width="260">
&nbsp;&nbsp;
<img src="docs/img/calendario-telefono-scuro.png" alt="Calendario su telefono, tema scuro" width="260">

</div>

## 🧱 Com'è fatto

```
ScoutPlanner
├── frontend/   React 19 + Vite + TanStack Query + zustand   → GitHub Pages
├── backend/    FastAPI + SQLite                            → Raspberry Pi (systemd + Tailscale Funnel)
├── docs/       guide e immagini
└── tools/      strumenti di prova (es. GPX)
```

- **Sessioni:** token firmati (itsdangerous), password con argon2, link di condivisione salvati come hash.
- **Frontend:** `HashRouter`, nessun server da configurare lato Pages.
- **Backend:** database SQLite in un file, nessun servizio esterno obbligatorio.

## 🚀 Provalo in locale

**Backend**

```bash
cd backend
python -m venv venv && venv/Scripts/activate   # su Linux/Mac: source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env                            # imposta SECRET_KEY (e SMTP se vuoi le email)
uvicorn app.main:app --port 8093
```

**Frontend**

```bash
cd frontend
npm install
npm run dev
```

Per il pulsante «Continua con Google» imposta `VITE_GOOGLE_CLIENT_ID` nel frontend e `GOOGLE_CLIENT_ID` nel backend; senza, il pulsante non compare.

**Test**

```bash
cd backend && pytest
```

## 📦 Deploy

- **Frontend:** a ogni push su `main` che tocca `frontend/` parte il workflow *deploy-frontend* e pubblica su GitHub Pages.
- **Backend:** vedi [docs/deployment.md](docs/deployment.md) (Raspberry Pi, systemd, Tailscale Funnel).

---

<div align="center">
<sub>Fatto con 🔥 per i campi scout.</sub>
</div>
