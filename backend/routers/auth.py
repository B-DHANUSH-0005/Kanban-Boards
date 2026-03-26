from fastapi import APIRouter, HTTPException, Depends, Response
from db import get_connection
from models import UserCreate, UserLogin, UserResponse
from passlib.context import CryptContext
from datetime import datetime, timedelta

router = APIRouter(prefix="/auth", tags=["Authentication"])
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

def hash_password(password: str):
    return pwd_context.hash(password)

def verify_password(plain_password, hashed_password):
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        return False

@router.post("/register", response_model=UserResponse)
def register(user: UserCreate):
    from db import db_conn
    with db_conn() as conn:
        cur = conn.cursor()
        
        # Check if user exists
        cur.execute('SELECT "User_id" FROM users WHERE username = %s', (user.username,))
        if cur.fetchone():
            cur.close()
            raise HTTPException(status_code=400, detail="Username already registered")
        
        hashed_pwd = hash_password(user.password)
        cur.execute(
            'INSERT INTO users (username, password) VALUES (%s, %s) RETURNING username, created_at',
            (user.username, hashed_pwd)
        )
        row = cur.fetchone()
        conn.commit()
        cur.close()
    
    return {"message": "User registered successfully", "username": row[0], "created_at": row[1]}

@router.post("/login")
def login(user: UserLogin, response: Response):
    from db import db_conn
    with db_conn() as conn:
        cur = conn.cursor()
        
        cur.execute('SELECT "User_id", username, password FROM users WHERE username = %s', (user.username,))
        row = cur.fetchone()
        cur.close()
    
    if not row or not verify_password(user.password, row[2]):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    # In a real app, use JWT. For now, we'll use a simple cookie as requested.
    response.set_cookie(
        key="user_id", 
        value=str(row[0]), 
        path="/", 
        httponly=False,  # Allow debugging tools to see it
        samesite="lax",
        secure=False     # For local testing over HTTP
    )
    response.set_cookie(
        key="username", 
        value=row[1], 
        path="/", 
        httponly=False,
        samesite="lax",
        secure=False
    )
    
    return {"message": "Login successful", "username": row[1], "user_id": row[0]}
