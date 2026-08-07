import os

SECRET_KEY = os.environ["SECRET_KEY"]
DB_PATH = os.environ.get("DB_PATH", "scoutplanner.db")

SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")

FRONTEND_ORIGIN = os.environ.get("FRONTEND_ORIGIN", "https://andreadp291-pixel.github.io")
FRONTEND_BASE_URL = os.environ.get("FRONTEND_BASE_URL", "https://andreadp291-pixel.github.io/ScoutPlanner")

MAGIC_LINK_MAX_AGE = 15 * 60          # 15 minuti
OWNER_SESSION_MAX_AGE = 30 * 24 * 3600  # 30 giorni
MEMBER_SESSION_MAX_AGE = 30 * 24 * 3600  # 30 giorni

LOGIN_WINDOW_SECONDS = 300
LOGIN_MAX_ATTEMPTS = 8

UPLOADS_DIR = os.environ.get("UPLOADS_DIR", "uploads")
UPLOADS_BASE_URL = os.environ.get("UPLOADS_BASE_URL", "/uploads")
MAX_UPLOAD_BYTES = 15 * 1024 * 1024  # 15 MB
