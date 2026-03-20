import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))
from db import get_connection

def check_schema():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'users'")
    print("Users table columns:", [r[0] for r in cur.fetchall()])
    cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'boards'")
    print("Boards table columns:", [r[0] for r in cur.fetchall()])
    cur.close()
    conn.close()

if __name__ == "__main__":
    check_schema()
