import os
import psycopg2
from psycopg2 import pool
from dotenv import load_dotenv
from contextlib import contextmanager

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

# ── Connection Pool ───────────────────────────────────────────
# Use a connection pool to avoid the overhead of opening 
# a new connection for every single request.
_pool = None

def get_pool():
    global _pool
    if _pool is None:
        try:
            # Min 1, Max 10 connections
            _pool = pool.SimpleConnectionPool(1, 15, dsn=DATABASE_URL)
            print("[OK] Connection Pool Initialized")
        except Exception as e:
            print(f"Error creating connection pool: {e}")
            raise
    return _pool

def get_connection():
    """Retrieve a connection from the pool."""
    return get_pool().getconn()

def put_connection(conn):
    """Return a connection back to the pool."""
    if _pool and conn:
        _pool.putconn(conn)

@contextmanager
def db_conn():
    """Context manager for getting/returning connections to the pool."""
    conn = get_connection()
    try:
        yield conn
    finally:
        put_connection(conn)


def create_tables():
    """Create users, boards, and tasks tables if they don't exist."""
    with db_conn() as conn:
        cur = conn.cursor()
        
        # Create users table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS users (
                "User_id" SERIAL PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                "hashed password" TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Create boards table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS boards (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users("User_id"),
                name TEXT NOT NULL,
                description TEXT,
                owner_username TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Create tasks table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS tasks (
                id SERIAL PRIMARY KEY,
                board_id INTEGER REFERENCES boards(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                description TEXT,
                status TEXT DEFAULT 'todo',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        conn.commit()
        cur.close()
    print("[OK] Database tables ready")
