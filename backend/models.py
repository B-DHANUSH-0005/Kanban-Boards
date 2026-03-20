from pydantic import BaseModel
from typing import Optional
from datetime import datetime


# ── Board Models ──────────────────────────────────────────────
class BoardCreate(BaseModel):
    name: str
    description: Optional[str] = None


class BoardUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class BoardMerge(BaseModel):
    target_board_id: int



class BoardResponse(BaseModel):
    message: Optional[str] = None
    id: int
    name: str
    description: Optional[str]
    created_at: Optional[datetime] = None


# ── Task Models ───────────────────────────────────────────────
class TaskCreate(BaseModel):
    board_id: int

    title: str
    description: Optional[str] = None
    status: Optional[str] = "todo"   # "todo" | "doing" | "done"


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    board_id: Optional[int] = None



class TaskMove(BaseModel):
    status: str   # todo | doing | done


class TaskResponse(BaseModel):
    message: Optional[str] = None
    id: int
    board_id: int

    title: str
    description: Optional[str]
    status: str
    created_at: Optional[datetime] = None


# ── User Models ───────────────────────────────────────────────
class UserCreate(BaseModel):
    username: str
    password: str


class UserLogin(BaseModel) :
    username: str
    password: str


class UserResponse(BaseModel):
    message: Optional[str] = None
    username: str
    created_at: Optional[datetime] = None
