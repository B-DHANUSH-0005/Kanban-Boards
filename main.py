"""
main.py — FastAPI application entry-point.
All config is loaded via config.py from the .env file.
"""
import sys
import os
from contextlib import asynccontextmanager

# Ensure the backend package is importable when running from the project root
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, RedirectResponse

from config import HOST, PORT, ALLOWED_ORIGINS
from db import create_tables
from routers import boards, tasks, auth

# ── Lifespan (Startup/Shutdown) ─────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Ensure DB tables and indexes exist
    create_tables()
    yield
    # Shutdown logic (if any) goes here

# ── App ───────────────────────────────────────────────────────
app = FastAPI(
    title="KanBoards API",
    version="2.1.0",
    description="Kanban board API — JWT Bearer Auth, Thread-safe, Optimized.",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan
)

# ── CORS ──────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(boards.router)
app.include_router(tasks.router)

# ── Static files & HTML Routes ────────────────────────────────
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "frontend")
app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")


@app.get("/", include_in_schema=False)
def serve_root():
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))


@app.get("/register", include_in_schema=False)
def serve_register():
    return FileResponse(os.path.join(FRONTEND_DIR, "register.html"))


@app.get("/login", include_in_schema=False)
def serve_login():
    return FileResponse(os.path.join(FRONTEND_DIR, "login.html"))


@app.get("/board", include_in_schema=False)
def serve_board(request: Request, id: str | None = None):
    # Only redirect if no board ID is provided (cleaner UX)
    if not id:
        return RedirectResponse(url="/")
    return FileResponse(os.path.join(FRONTEND_DIR, "board.html"))


# ── Dev entry-point ───────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    # Use standard host/port from config, with reload enabled for development
    uvicorn.run("main:app", host=HOST, port=PORT, reload=True)
