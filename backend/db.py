import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")


def get_connection():
    return psycopg2.connect(DATABASE_URL)


def create_tables():
    """Create users, boards, and tasks tables if they don't exist."""
    conn = get_connection()
    cur = conn.cursor()
    
    # Create users table (matching the actual schema found)
    # Using "User_id" with double quotes to match the case-sensitive name from schema check
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
    print("[OK] Database tables ready")
    cur.close()
    conn.close()
