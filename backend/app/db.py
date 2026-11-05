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
    role          TEXT NOT NULL CHECK (role IN ('editor','viewer','commenter')),
    revoked_at    TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    last_used_at  TEXT,
    expires_at    TEXT
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
    role          TEXT NOT NULL CHECK (role IN ('editor','viewer','commenter')),
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

-- Responsabili delle attività. person_ref: 'o' = owner, 'm<id>' = membro con account,
-- 't<id>' = persona con link (vedi routers/people.py).
CREATE TABLE IF NOT EXISTS activity_assignees (
    activity_id   INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    person_ref    TEXT NOT NULL,
    PRIMARY KEY (activity_id, person_ref)
);

-- Chi procura / chi trasporta un materiale. La lista dei materiali è ricavata dal testo
-- delle attività; name_key è il nome in minuscolo.
CREATE TABLE IF NOT EXISTS material_assignments (
    project_id    INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name_key      TEXT NOT NULL,
    procure_ref   TEXT,
    transport_ref TEXT,
    PRIMARY KEY (project_id, name_key)
);

-- Posizione unica del campo (1:1 col progetto): usata anche come centro per la
-- ricerca dei punti di interesse vicini (ospedali, farmacie, vigili del fuoco).
CREATE TABLE IF NOT EXISTS project_locations (
    project_id    INTEGER PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    lat           REAL NOT NULL,
    lon           REAL NOT NULL,
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS project_pois (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id    INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    kind          TEXT NOT NULL CHECK (kind IN ('hospital','pharmacy','fire_station','other')),
    name          TEXT NOT NULL,
    phone         TEXT NOT NULL DEFAULT '',
    address       TEXT NOT NULL DEFAULT '',
    lat           REAL,
    lon           REAL,
    notes         TEXT NOT NULL DEFAULT '',
    hours         TEXT NOT NULL DEFAULT '',
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_project_pois_project_id ON project_pois(project_id);

-- Pagine libere di progetto (non legate a un giorno): stesso editor a blocchi
-- delle attività, "content" è JSON ActivityDoc come activities.description.
CREATE TABLE IF NOT EXISTS project_pages (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id    INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title         TEXT NOT NULL,
    content       TEXT NOT NULL DEFAULT '',
    position      INTEGER NOT NULL DEFAULT 0,
    created_by    TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_project_pages_project_id ON project_pages(project_id);

-- Cronologia delle modifiche ad attività e pagine. "before" è lo stato precedente (JSON) e serve a ripristinare.
CREATE TABLE IF NOT EXISTS activity_log (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id    INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    entity        TEXT NOT NULL CHECK (entity IN ('activity','page')),
    entity_id     INTEGER NOT NULL,
    action        TEXT NOT NULL,
    actor         TEXT NOT NULL,
    title         TEXT NOT NULL,
    summary       TEXT NOT NULL DEFAULT '',
    before        TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_activity_log_project ON activity_log(project_id, id);

-- Commenti sulle attività e sulle pagine, con risposte (parent_id) e stato "risolto".
CREATE TABLE IF NOT EXISTS comments (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id    INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    entity        TEXT NOT NULL CHECK (entity IN ('activity','page')),
    entity_id     INTEGER NOT NULL,
    parent_id     INTEGER REFERENCES comments(id) ON DELETE CASCADE,
    author        TEXT NOT NULL,
    author_ref    TEXT NOT NULL,
    body          TEXT NOT NULL,
    resolved_at   TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_comments_entity ON comments(project_id, entity, entity_id);

-- Chi non ha accesso a un progetto può chiederlo; l'owner approva (e sceglie il ruolo) o rifiuta.
CREATE TABLE IF NOT EXISTS access_requests (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id    INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    email         TEXT NOT NULL,
    name          TEXT NOT NULL,
    message       TEXT NOT NULL DEFAULT '',
    status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_access_requests_project ON access_requests(project_id, status);
"""

# Migrazioni idempotenti per DB creati prima dell'introduzione di una colonna.
MIGRATIONS = [
    "ALTER TABLE project_tokens ADD COLUMN email TEXT",
    "ALTER TABLE activities ADD COLUMN materials TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE project_pois ADD COLUMN hours TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE project_tokens ADD COLUMN expires_at TEXT",
    "ALTER TABLE activities ADD COLUMN deleted_at TEXT",  # cestino
    "ALTER TABLE project_pages ADD COLUMN deleted_at TEXT",
]


_ROLE_TABLES = ("project_tokens", "project_members")


def init_db() -> None:
    with get_conn() as conn:
        # SQLite non permette di cambiare un CHECK: nei DB creati prima del ruolo "commenter"
        # le due tabelle si ricreano e si ricopiano i dati (stesse colonne, stesso id).
        old = []
        for t in _ROLE_TABLES:
            row = conn.execute("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?", (t,)).fetchone()
            if row and "'commenter'" not in row["sql"]:
                conn.execute("PRAGMA foreign_keys = OFF")
                conn.execute(f"ALTER TABLE {t} RENAME TO {t}_old")
                conn.execute(f"DROP INDEX IF EXISTS idx_{t}_project_id")
                conn.execute(f"DROP INDEX IF EXISTS idx_project_members_project")
                conn.execute(f"DROP INDEX IF EXISTS idx_project_members_member")
                old.append(t)
        conn.executescript(SCHEMA)
        for migration in MIGRATIONS:
            try:
                conn.execute(migration)
            except sqlite3.OperationalError:
                pass  # colonna già presente
        for t in old:
            cols = [r["name"] for r in conn.execute(f"PRAGMA table_info({t})")]
            old_cols = {r["name"] for r in conn.execute(f"PRAGMA table_info({t}_old)")}
            shared = ", ".join(c for c in cols if c in old_cols)
            conn.execute(f"INSERT INTO {t} ({shared}) SELECT {shared} FROM {t}_old")
            conn.execute(f"DROP TABLE {t}_old")
        if old:
            conn.execute("PRAGMA foreign_keys = ON")


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
