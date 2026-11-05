import asyncio
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from . import notify
from .config import FRONTEND_ORIGIN, SMTP_PASSWORD, SMTP_USER, UPLOADS_DIR
from .db import init_db
from .routers import (
    access,
    activities,
    auth,
    comments,
    groups,
    history,
    materials,
    me,
    members,
    people,
    project_location,
    project_pages,
    project_pois,
    projects,
    reports,
    tokens,
    uploads,
)

@asynccontextmanager
async def lifespan(_app):
    init_db()
    history.purge_trash()
    # il report giornaliero parte solo dove le email sono davvero configurate
    task = asyncio.create_task(notify.report_loop()) if SMTP_USER and SMTP_PASSWORD else None
    yield
    if task:
        task.cancel()


app = FastAPI(title="ScoutPlanner API", lifespan=lifespan)

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
app.include_router(people.router)
app.include_router(materials.router)
app.include_router(project_location.router)
app.include_router(project_pois.router)
app.include_router(project_pages.router)
app.include_router(history.router)
app.include_router(comments.router)
app.include_router(access.router)
app.include_router(reports.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
