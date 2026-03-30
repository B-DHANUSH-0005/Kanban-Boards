import sys
import os

# Ensure backend is in path
sys.path.insert(0, os.path.join(os.getcwd(), "backend"))

try:
    from db import db_conn
    from config import DATABASE_URL
    print(f"Attempting to connect to: {DATABASE_URL[:20]}...")
    
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT 1")
            print("Successfully connected and executed SELECT 1")
            
            # Check tables
            cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")
            tables = [r[0] for r in cur.fetchall()]
            print(f"Tables in DB: {tables}")
            
except Exception as e:
    print(f"Error connecting to DB: {e}")
    sys.exit(1)
