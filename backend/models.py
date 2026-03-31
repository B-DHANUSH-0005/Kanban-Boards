"""
models.py — Pydantic request/response schemas with full validation.
All limits come from config.py so they're soft-coded.
"""
from __future__ import annotations
from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime
from config import (
    PASSWORD_MIN_LEN,
    BOARD_NAME_MAX_LEN, BOARD_DESC_MAX_LEN,
    TASK_TITLE_MAX_LEN, TASK_DESC_MAX_LEN,
    VALID_TASK_STATUSES,
    DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE,
)

# ── Pagination ────────────────────────────────────────────────
class PaginationParams(BaseModel):
    page: int = Field(default=1, ge=1, description="Page number (1-indexed)")
    page_size: int = Field(default=DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE)

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size

    @property
    def limit(self) -> int:
        return self.page_size


class PaginatedResponse(BaseModel):
    total: int
    page: int
    page_size: int
    total_pages: int
    items: list


# ── Board Models ──────────────────────────────────────────────
class BoardCreate(BaseModel):
    name: str = Field(
        min_length=1,
        max_length=BOARD_NAME_MAX_LEN,
        description="Board name (required)",
    )
    description: Optional[str] = Field(
        default=None,
        max_length=BOARD_DESC_MAX_LEN,
        description="Optional board description",
    )

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Board name cannot be blank")
        return v.strip()

    @field_validator("description")
    @classmethod
    def strip_description(cls, v: Optional[str]) -> Optional[str]:
        return v.strip() if v else None


class BoardUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=BOARD_NAME_MAX_LEN)
    description: Optional[str] = Field(default=None, max_length=BOARD_DESC_MAX_LEN)
    columns: Optional[list[str]] = None
    deleted_columns: Optional[list[str]] = None

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not v.strip():
            raise ValueError("Board name cannot be blank")
        return v.strip() if v else v

    @field_validator("description")
    @classmethod
    def strip_description(cls, v: Optional[str]) -> Optional[str]:
        return v.strip() if v else None


class BoardMerge(BaseModel):
    target_board_id: int = Field(gt=0, description="ID of the board to merge into")


class BoardResponse(BaseModel):
    message: Optional[str] = None
    id: int
    name: str
    description: Optional[str]
    columns: list[str] = Field(default_factory=lambda: ["todo", "doing", "done"])
    deleted_columns: list[str] = Field(default_factory=list)
    created_at: Optional[datetime] = None


# ── Task Models ───────────────────────────────────────────────
class TaskCreate(BaseModel):
    board_id: int = Field(gt=0)
    title: str = Field(
        min_length=1,
        max_length=TASK_TITLE_MAX_LEN,
        description="Task title (required)",
    )
    description: Optional[str] = Field(default=None, max_length=TASK_DESC_MAX_LEN)
    status: Optional[str] = Field(default="todo")

    @field_validator("title")
    @classmethod
    def title_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Task title cannot be blank")
        return v.strip()

    @field_validator("description")
    @classmethod
    def strip_description(cls, v: Optional[str]) -> Optional[str]:
        return v.strip() if v else None

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: Optional[str]) -> str:
        # Relaxed for dynamic columns; router will verify against board columns
        return (v or "todo").lower().strip()


class TaskUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=TASK_TITLE_MAX_LEN)
    description: Optional[str] = Field(default=None, max_length=TASK_DESC_MAX_LEN)
    status: Optional[str] = None
    board_id: Optional[int] = Field(default=None, gt=0)

    @field_validator("title")
    @classmethod
    def title_not_blank(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not v.strip():
            raise ValueError("Task title cannot be blank")
        return v.strip() if v else v

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        # Relaxed for dynamic columns; router will verify against board columns
        return v.lower().strip()


class TaskMove(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        # Relaxed for dynamic columns; router will verify against board columns
        return v.lower().strip()


class TaskResponse(BaseModel):
    message: Optional[str] = None
    id: int
    board_id: int
    title: str
    description: Optional[str]
    status: str
    created_at: Optional[datetime] = None


# ── User / Auth Models ────────────────────────────────────────
class UserCreate(BaseModel):
    email_id: str = Field(
        min_length=3,
        max_length=254,
        description="Email address used to log in",
    )
    password: str = Field(
        min_length=PASSWORD_MIN_LEN,
        max_length=72,
        description=f"Password (minimum {PASSWORD_MIN_LEN} characters, max 72 characters)",
    )

    @field_validator("email_id")
    @classmethod
    def validate_email(cls, v: str) -> str:
        import re
        v = v.strip()
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", v):
            raise ValueError("Please enter a valid email address")
        return v

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < PASSWORD_MIN_LEN:
            raise ValueError(f"Password must be at least {PASSWORD_MIN_LEN} characters long")
        return v


class UserLogin(BaseModel):
    email_id: str = Field(min_length=1, max_length=254)
    password: str = Field(min_length=1, max_length=72)


class UserResponse(BaseModel):
    message: Optional[str] = None
    email_id: str
    created_at: Optional[datetime] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str
    user_id: int


# ── Forgot-password flow models ───────────────────────────────
class ForgotPasswordRequest(BaseModel):
    email_id: str = Field(min_length=1, max_length=254)


class VerifyCodeRequest(BaseModel):
    email_id: str = Field(min_length=1, max_length=254)
    code: str = Field(min_length=4, max_length=4)


class ResetPasswordRequest(BaseModel):
    email_id: str = Field(min_length=1, max_length=254)
    code: str = Field(min_length=4, max_length=4)
    new_password: str = Field(min_length=6, max_length=72)
