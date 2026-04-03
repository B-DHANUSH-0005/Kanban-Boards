"""
routers/auth.py — Registration, login, and forgot-password endpoints.
Uses email_id as the primary identifier (username column removed).
OTPs are stored in-memory with a 10-minute TTL.
"""
import random
import smtplib
import time
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from fastapi import APIRouter, HTTPException, status
from db import db_conn
from models import (
    UserCreate, UserLogin, UserResponse, TokenResponse,
    ForgotPasswordRequest, VerifyCodeRequest, ResetPasswordRequest,
)
from security import hash_password, verify_password, create_access_token
from config import (
    SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])

# ── In-memory OTP store: { email_id: (code, expires_at) } ─────
_otp_store: dict[str, tuple[str, float]] = {}
OTP_TTL = 300  # 5 minutes


def _send_otp_email(to_email: str, code: str) -> None:
    """Send a 4-digit OTP to the given email via SMTP."""
    msg = MIMEMultipart("alternative")
    msg["Subject"] = "KanBoards — Your password reset code"
    msg["From"] = SMTP_FROM
    msg["To"] = to_email

    body = f"""
    <html><body style="font-family:Arial,sans-serif;background:#f5f5f5;padding:24px">
      <div style="max-width:420px;margin:auto;background:#fff;border:1px solid #ddd;
                  border-radius:8px;padding:32px">
        <h2 style="margin-top:0;color:#111">KanBoards Password Reset</h2>
        <p style="color:#444">Use the code below to reset your password.
           It expires in <strong>5 minutes</strong>.</p>
        <div style="font-size:36px;font-weight:700;letter-spacing:10px;
                    text-align:center;padding:20px 0;color:#111">{code}</div>
        <p style="color:#888;font-size:12px">If you didn't request this, you can safely ignore this email.</p>
      </div>
    </body></html>
    """
    msg.attach(MIMEText(body, "html"))

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.ehlo()
        server.starttls()
        server.login(SMTP_USER, SMTP_PASS)
        server.sendmail(SMTP_FROM, to_email, msg.as_string())


# ── POST /auth/register ───────────────────────────────────────
@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new user account",
)
def register(user: UserCreate) -> dict:
    with db_conn() as conn:
        with conn.cursor() as cur:
            # Check for duplicate email (case-insensitive)
            cur.execute(
                "SELECT id FROM users WHERE LOWER(email_id) = LOWER(%s)",
                (user.email_id,),
            )
            if cur.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="An account with this email already exists.",
                )

            hashed = hash_password(user.password)
            cur.execute(
                "INSERT INTO users (email_id, password) VALUES (%s, %s)"
                " RETURNING email_id, created_at",
                (user.email_id, hashed),
            )
            row = cur.fetchone()
            conn.commit()

    return {
        "message": "Account created successfully! You can now log in.",
        "email_id": row[0],
        "created_at": row[1],
    }


# ── POST /auth/login ──────────────────────────────────────────
@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Authenticate and receive a JWT access token",
)
def login(user: UserLogin) -> dict:
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, email_id, password FROM users WHERE LOWER(email_id) = LOWER(%s)",
                (user.email_id,),
            )
            row = cur.fetchone()

    if not row or not verify_password(user.password, row[2]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    token = create_access_token(user_id=row[0], username=row[1])

    return {
        "access_token": token,
        "token_type": "bearer",
        "username": row[1],   # email_id used as display name
        "user_id": row[0],
    }


# ── POST /auth/forgot-password ────────────────────────────────
@router.post(
    "/forgot-password",
    summary="Send a 4-digit OTP to the registered email",
)
def forgot_password(body: ForgotPasswordRequest) -> dict:
    email = body.email_id.strip().lower()

    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id FROM users WHERE LOWER(email_id) = %s", (email,)
            )
            row = cur.fetchone()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account found with this email address.",
        )

    code = str(random.randint(1000, 9999))
    _otp_store[email] = (code, time.time() + OTP_TTL)

    try:
        _send_otp_email(body.email_id.strip(), code)
    except Exception as exc:
        # Remove stored OTP so user can retry
        _otp_store.pop(email, None)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Failed to send email. Please try again. ({exc})",
        )

    return {"message": "A 4-digit code has been sent to your email."}


# ── POST /auth/verify-code ────────────────────────────────────
@router.post(
    "/verify-code",
    summary="Verify the OTP code sent to email",
)
def verify_code(body: VerifyCodeRequest) -> dict:
    email = body.email_id.strip().lower()
    entry = _otp_store.get(email)

    if not entry:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No code was requested for this email. Please request a new one.",
        )

    stored_code, expires_at = entry
    if time.time() > expires_at:
        _otp_store.pop(email, None)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP expired. Please request a new one.",
        )

    if body.code != stored_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect code. Please try again.",
        )

    return {"message": "Code verified. You may now reset your password."}


# ── POST /auth/reset-password ─────────────────────────────────
@router.post(
    "/reset-password",
    summary="Reset password after OTP verification",
)
def reset_password(body: ResetPasswordRequest) -> dict:
    email = body.email_id.strip().lower()
    entry = _otp_store.get(email)

    if not entry:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session expired. Please restart the forgot-password flow.",
        )

    stored_code, expires_at = entry
    if time.time() > expires_at or body.code != stored_code:
        _otp_store.pop(email, None)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired code.",
        )

    with db_conn() as conn:
        with conn.cursor() as cur:
            # Check if the new password is the same as the old password
            cur.execute("SELECT password FROM users WHERE LOWER(email_id) = %s", (email,))
            row = cur.fetchone()
            
            if row and verify_password(body.new_password, row[0]):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="New password cannot be the same as the previous password."
                )

            hashed = hash_password(body.new_password)
            cur.execute(
                "UPDATE users SET password = %s WHERE LOWER(email_id) = %s",
                (hashed, email),
            )
            conn.commit()

    _otp_store.pop(email, None)
    return {"message": "Password updated successfully. You can now log in."}
