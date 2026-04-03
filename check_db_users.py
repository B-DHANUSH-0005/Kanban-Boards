import os
from dotenv import load_dotenv
import psycopg2

load_dotenv()
conn = psycopg2.connect(os.getenv('DATABASE_URL'))
cur = conn.cursor()
cur.execute('SELECT email_id, password FROM users')
for r in cur.fetchall():
    print(f'Email: "{r[0]}" | Hash: "{r[1]}"')
conn.close()
