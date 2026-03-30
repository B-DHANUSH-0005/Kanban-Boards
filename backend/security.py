"""
security.py — JWT creation/verification and the shared FastAPI auth dependency.
All other routers import `get_current_user_id` from here — single source of truth.
"""
from __future__ import annotations
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext

from config import JWT_SECRET_KEY, JWT_ALGORITHM, JWT_EXPIRE_MINUTES

# ── Password hashing ──────────────────────────────────────────
_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    return _pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return _pwd_context.verify(plain, hashed)
    except Exception:
        return False


# ── JWT helpers ───────────────────────────────────────────────
_bearer_scheme = HTTPBearer(auto_error=False)


def create_access_token(user_id: int, username: str) -> str:
    """Create a signed JWT with user_id and username as claims."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "username": username,
        "iat": now,
        "exp": now + timedelta(minutes=JWT_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> Optional[dict]:
    """Decode and verify a JWT. Returns the payload dict or None on failure."""
    try:
        return jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
    except JWTError:
        return None


# ── FastAPI dependency ────────────────────────────────────────
def get_current_user_id(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
) -> int:
    """
    Extracts and validates the Bearer JWT.
    Raises 401 if token is missing or invalid.
    Returns the authenticated user_id as int.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated — please log in",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(credentials.credentials)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token — please log in again",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return int(payload["sub"])
