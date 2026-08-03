from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import FRONTEND_ORIGIN
from .db import init_db
from .routers import activities, auth, projects, tokens

app = FastAPI(title="ScoutPlanner API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN],
    allow_methods=["*"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(auth.router)
app.include_router(projects.router)
app.include_router(activities.router)
app.include_router(tokens.router)


@app.on_event("startup")
async def on_startup():
    init_db()


@app.get("/health")
async def health():
    return {"status": "ok"}
