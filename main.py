import sys
import os

# Make sure backend directory is on the path so routers can import db & models
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from db import create_tables
from routers import boards, tasks, auth

app = FastAPI(title="Kanban Board API", version="1.0.0")

app.include_router(boards.router)
app.include_router(tasks.router)
app.include_router(auth.router)

# ── CORS ──────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Static files (frontend) ───────────────────────────────────
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "frontend")
app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")


# ── Serve HTML pages ──────────────────────────────────────────
@app.get("/")
def serve_index():
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))


@app.get("/board")
def serve_board():
    return FileResponse(os.path.join(FRONTEND_DIR, "board.html"))


@app.get("/login")
def serve_login():
    return FileResponse(os.path.join(FRONTEND_DIR, "login.html"))


@app.get("/register")
def serve_register():
    return FileResponse(os.path.join(FRONTEND_DIR, "register.html"))


# ── Startup ───────────────────────────────────────────────────
@app.on_event("startup")
def startup():
    create_tables()
    print("[OK] Database tables ready")
