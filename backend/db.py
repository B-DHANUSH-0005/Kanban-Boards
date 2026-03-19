import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")


def get_connection():
    return psycopg2.connect(DATABASE_URL)


def create_tables():
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("CREATE SEQUENCE IF NOT EXISTS board_id_seq;")
    cur.execute("""
        CREATE TABLE IF NOT EXISTS boards (
            id VARCHAR(5) DEFAULT to_char(nextval('board_id_seq'), 'FM00000') PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cur.execute("CREATE SEQUENCE IF NOT EXISTS task_id_seq;")
    cur.execute("""
        CREATE TABLE IF NOT EXISTS tasks (
            id VARCHAR(9) DEFAULT 'task_' || to_char(nextval('task_id_seq'), 'FM0000') PRIMARY KEY,
            board_id VARCHAR(5) REFERENCES boards(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            description TEXT,
            status TEXT DEFAULT 'to do',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            username TEXT PRIMARY KEY,
            password TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.commit()
    cur.close()
    conn.close()
