import sys
import os

sys.path.insert(0, os.path.join(os.getcwd(), "backend"))
from db import db_conn

def migrate():
    with db_conn() as conn:
        with conn.cursor() as cur:
            # 1. Users table
            # Check if columns exist before renaming
            cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'users'")
            cols = [r[0] for r in cur.fetchall()]
            
            if "User_id" in cols:
                print("Renaming User_id -> id")
                cur.execute('ALTER TABLE users RENAME COLUMN "User_id" TO id')
            
            # Since the user has 'password' and 'hashed password', we should unify
            if "hashed password" in cols:
                print("Renaming 'hashed password' -> password")
                if "password" in cols:
                    cur.execute('ALTER TABLE users RENAME COLUMN "password" TO "old_plain_password"')
                cur.execute('ALTER TABLE users RENAME COLUMN "hashed password" TO password')

            # 2. Boards table
            cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'boards'")
            cols = [r[0] for r in cur.fetchall()]
            if "owner_username" in cols:
                # We already have user_id, so owner_username is redundant
                print("Dropping redundant owner_username from boards")
                cur.execute("ALTER TABLE boards DROP COLUMN owner_username")

        conn.commit()
    print("Migration successful.")

if __name__ == "__main__":
    migrate()
