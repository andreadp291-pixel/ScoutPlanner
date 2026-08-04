import sqlite3
from contextlib import contextmanager

from .config import DB_PATH

SCHEMA = """
CREATE TABLE IF NOT EXISTS projects (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    owner_email   TEXT NOT NULL,
    start_date    TEXT NOT NULL,
    end_date      TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_projects_owner_email ON projects(owner_email);

CREATE TABLE IF NOT EXISTS activities (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id    INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title         TEXT NOT NULL,
    description   TEXT NOT NULL DEFAULT '',
    location      TEXT NOT NULL DEFAULT '',
    category      TEXT NOT NULL,
    color         TEXT NOT NULL,
    start_at      TEXT NOT NULL,
    end_at        TEXT NOT NULL,
    created_by    TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_activities_project_id ON activities(project_id);

CREATE TABLE IF NOT EXISTS project_tokens (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id    INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    token_hash    TEXT NOT NULL UNIQUE,
    person_name   TEXT NOT NULL,
    email         TEXT,
    role          TEXT NOT NULL CHECK (role IN ('editor','viewer')),
    revoked_at    TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    last_used_at  TEXT
);
CREATE INDEX IF NOT EXISTS idx_project_tokens_project_id ON project_tokens(project_id);

-- Persone invitate con email: account con password personale (niente link da condividere).
CREATE TABLE IF NOT EXISTS members (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    email                 TEXT NOT NULL UNIQUE,
    display_name          TEXT NOT NULL,
    password_hash         TEXT NOT NULL,
    must_change_password  INTEGER NOT NULL DEFAULT 1,
    token_version         INTEGER NOT NULL DEFAULT 0,
    created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS project_members (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id    INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    member_id     INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    role          TEXT NOT NULL CHECK (role IN ('editor','viewer')),
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (project_id, member_id)
);
CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_member ON project_members(member_id);

-- Password opzionale per gli owner: il magic link resta sempre disponibile,
-- la password è un'alternativa più comoda una volta impostata dall'owner stesso.
CREATE TABLE IF NOT EXISTS owners (
    email          TEXT PRIMARY KEY,
    password_hash  TEXT,
    token_version  INTEGER NOT NULL DEFAULT 0,
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS groups (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id    INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_groups_project_id ON groups(project_id);

CREATE TABLE IF NOT EXISTS activity_groups (
    activity_id   INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    group_id      INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    PRIMARY KEY (activity_id, group_id)
);
CREATE INDEX IF NOT EXISTS idx_activity_groups_group_id ON activity_groups(group_id);
"""

# Migrazioni idempotenti per DB creati prima dell'introduzione di una colonna.
MIGRATIONS = [
    "ALTER TABLE project_tokens ADD COLUMN email TEXT",
    "ALTER TABLE activities ADD COLUMN materials TEXT NOT NULL DEFAULT ''",
]


def init_db() -> None:
    with get_conn() as conn:
        conn.executescript(SCHEMA)
        for migration in MIGRATIONS:
            try:
                conn.execute(migration)
            except sqlite3.OperationalError:
                pass  # colonna già presente


@contextmanager
def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()
