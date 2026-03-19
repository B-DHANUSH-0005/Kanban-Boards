from fastapi import APIRouter, HTTPException, status
from db import get_connection
from models import UserCreate, UserLogin, UserResponse
from typing import Optional

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(user: UserCreate):
    conn = get_connection()
    cur = conn.cursor()
    
    # Check if user already exists
    cur.execute("SELECT username FROM users WHERE username = %s", (user.username,))
    if cur.fetchone():
        cur.close()
        conn.close()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already registered")
    
    cur.execute(
        "INSERT INTO users (username, password) VALUES (%s, %s) RETURNING username, created_at",
        (user.username, user.password)
    )
    row = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()
    
    return {"message": "User registered successfully!", "username": row[0], "created_at": row[1]}


@router.post("/login", response_model=UserResponse)
def login(user: UserLogin):
    conn = get_connection()
    cur = conn.cursor()
    
    cur.execute("SELECT username, password, created_at FROM users WHERE username = %s", (user.username,))
    row = cur.fetchone()
    cur.close()
    conn.close()
    
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    if row[1] != user.password:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect password")
    
    return {"message": "Login successful!", "username": row[0], "created_at": row[2]}
