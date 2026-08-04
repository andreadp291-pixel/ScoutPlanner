import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import FRONTEND_ORIGIN, UPLOADS_DIR
from .db import init_db
from .routers import activities, auth, groups, me, members, projects, tokens, uploads

app = FastAPI(title="ScoutPlanner API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN],
    allow_methods=["*"],
    allow_headers=["Authorization", "Content-Type"],
)

os.makedirs(UPLOADS_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")

app.include_router(auth.router)
app.include_router(projects.router)
app.include_router(activities.router)
app.include_router(groups.router)
app.include_router(uploads.router)
app.include_router(tokens.router)
app.include_router(members.router)
app.include_router(me.router)


@app.on_event("startup")
async def on_startup():
    init_db()


@app.get("/health")
async def health():
    return {"status": "ok"}
