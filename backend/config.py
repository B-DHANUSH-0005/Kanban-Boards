"""
config.py — Loads all app settings from .env (soft-coded, never hardcoded).
All other modules import from here so there's a single source of truth.
"""
import os
from dotenv import load_dotenv

load_dotenv()

# ── Database ──────────────────────────────────────────────────
DATABASE_URL: str = os.getenv("DATABASE_URL", "")

# Pool sizing
DB_POOL_MIN: int = int(os.getenv("DB_POOL_MIN", "1"))
DB_POOL_MAX: int = int(os.getenv("DB_POOL_MAX", "15"))

# ── JWT ───────────────────────────────────────────────────────
JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "CHANGE_ME")
JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_MINUTES: int = int(os.getenv("JWT_EXPIRE_MINUTES", "1440"))  # 24 h

# ── Server ────────────────────────────────────────────────────
HOST: str = os.getenv("HOST", "127.0.0.1")
PORT: int = int(os.getenv("PORT", "8000"))
ALLOWED_ORIGINS: list[str] = [
    o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
]
# Add known Vercel origins if not already present
if "https://kanban-fe-seven.vercel.app" not in ALLOWED_ORIGINS:
    ALLOWED_ORIGINS.append("https://kanban-fe-seven.vercel.app")
if "https://kanban-boards-ten.vercel.app" not in ALLOWED_ORIGINS:
    ALLOWED_ORIGINS.append("https://kanban-boards-ten.vercel.app")

# ── Pagination ────────────────────────────────────────────────
DEFAULT_PAGE_SIZE: int = int(os.getenv("DEFAULT_PAGE_SIZE", "20"))
MAX_PAGE_SIZE: int = int(os.getenv("MAX_PAGE_SIZE", "100"))

# ── Validation Rules ──────────────────────────────────────────
PASSWORD_MIN_LEN: int = 6
BOARD_NAME_MAX_LEN: int = 80
BOARD_DESC_MAX_LEN: int = 500
TASK_TITLE_MAX_LEN: int = 120
TASK_DESC_MAX_LEN: int = 1000
VALID_TASK_STATUSES: frozenset[str] = frozenset({"todo", "doing", "done"})

# ── SMTP (for OTP emails) ─────────────────────────────────────
SMTP_HOST: str = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER: str = os.getenv("SMTP_USER", "")
SMTP_PASS: str = os.getenv("SMTP_PASS", "")
SMTP_FROM: str = os.getenv("SMTP_FROM", SMTP_USER)
