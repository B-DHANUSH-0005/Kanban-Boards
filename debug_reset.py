import sys
import os
import time
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "backend")))

from backend.routers.auth import _otp_store, reset_password
from backend.models import ResetPasswordRequest
from backend.db import db_conn

def test_reset():
    email = "test@example.com"
    code = "1234"
    _otp_store[email] = (code, time.time() + 300)
    
    # Ensure user exists
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("INSERT INTO users (email_id, password) VALUES (%s, %s) ON CONFLICT DO NOTHING", (email, "oldpass"))
            conn.commit()
            
    try:
        body = ResetPasswordRequest(email_id=email, code=code, new_password="newpassword-long-enough")
        res = reset_password(body)
        print("Success:", res)
    except Exception as e:
        print("Error:", e)
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_reset()
