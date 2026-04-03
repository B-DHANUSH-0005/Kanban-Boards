"""
db.py — Database connection pool using psycopg2.
All config is pulled from config.py (which reads .env).
"""
import psycopg2
from psycopg2 import pool
from contextlib import contextmanager
from config import DATABASE_URL, DB_POOL_MIN, DB_POOL_MAX

# Use ThreadedConnectionPool for thread-safety with FastAPI
_pool: pool.ThreadedConnectionPool | None = None


def _get_pool() -> pool.ThreadedConnectionPool:
    """Lazily initialise the threaded connection pool (singleton)."""
    global _pool
    if _pool is None:
        _pool = pool.ThreadedConnectionPool(DB_POOL_MIN, DB_POOL_MAX, dsn=DATABASE_URL)
        print("[DB] Threaded connection pool initialised")
    return _pool


def get_connection() -> psycopg2.extensions.connection:
    """Borrow a connection from the pool."""
    return _get_pool().getconn()


def put_connection(conn: psycopg2.extensions.connection) -> None:
    """Return a connection to the pool."""
    if _pool and conn:
        _pool.putconn(conn)


@contextmanager
def db_conn():
    """Context manager: borrow → yield → return connection."""
    conn = get_connection()
    try:
        yield conn
    except Exception:
        conn.rollback()
        raise
    finally:
        put_connection(conn)


def create_tables() -> None:
    """Idempotently create tables and indexes for performance."""
    with db_conn() as conn:
        cur = conn.cursor()

        # Users table (email_id is the canonical login identifier)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id          SERIAL PRIMARY KEY,
                email_id    TEXT UNIQUE NOT NULL,
                password    TEXT NOT NULL,
                created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Migration: add email_id if the table was created with `username`
        cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'users'")
        user_cols = [r[0] for r in cur.fetchall()]
        if "email_id" not in user_cols:
            cur.execute("ALTER TABLE users ADD COLUMN email_id TEXT UNIQUE")
            # Backfill from legacy username column when present
            if "username" in user_cols:
                cur.execute("UPDATE users SET email_id = username WHERE email_id IS NULL")
            # Enforce NOT NULL after backfill
            cur.execute("ALTER TABLE users ALTER COLUMN email_id SET NOT NULL")
        # Ensure a unique index exists even if the column was added later
        cur.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_id ON users(email_id)")

        # Boards table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS boards (
                id              SERIAL PRIMARY KEY,
                user_id         INTEGER REFERENCES users(id) ON DELETE CASCADE,
                name            TEXT NOT NULL,
                description     TEXT,
                columns         TEXT NOT NULL DEFAULT 'todo,doing,done',
                deleted_columns TEXT NOT NULL DEFAULT '',
                created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Migration: Ensure existing boards have the columns and deleted_columns fields if they were created before
        cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'boards'")
        cols = [r[0] for r in cur.fetchall()]
        if "columns" not in cols:
            cur.execute("ALTER TABLE boards ADD COLUMN columns TEXT NOT NULL DEFAULT 'todo,doing,done'")
        if "deleted_columns" not in cols:
            cur.execute("ALTER TABLE boards ADD COLUMN deleted_columns TEXT NOT NULL DEFAULT ''")
        # Index for faster board listings by user
        cur.execute("CREATE INDEX IF NOT EXISTS idx_boards_user_id ON boards(user_id)")

        # Tasks table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS tasks (
                id          SERIAL PRIMARY KEY,
                board_id    INTEGER REFERENCES boards(id) ON DELETE CASCADE,
                title       TEXT NOT NULL,
                description TEXT,
                status      TEXT NOT NULL DEFAULT 'todo',
                created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        # Index for faster task lookups by board and status
        cur.execute("CREATE INDEX IF NOT EXISTS idx_tasks_board_id ON tasks(board_id)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)")

        conn.commit()
        cur.close()

    print("[DB] Tables and indexes ready")
