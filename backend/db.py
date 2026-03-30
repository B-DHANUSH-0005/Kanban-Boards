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

        # Users table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id          SERIAL PRIMARY KEY,
                username    TEXT UNIQUE NOT NULL,
                password    TEXT NOT NULL,
                created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Boards table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS boards (
                id          SERIAL PRIMARY KEY,
                user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
                name        TEXT NOT NULL,
                description TEXT,
                created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
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
