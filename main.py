import sys
import os

# Make sure backend directory is on the path so routers can import db & models
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))

from typing import Optional
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, RedirectResponse
from db import create_tables
from routers import boards, tasks, auth

app = FastAPI(title="Kanban Board API", version="1.0.0")

# ── CORS (must be added BEFORE routers) ───────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(boards.router)
app.include_router(tasks.router)

# ── Static files (frontend) ───────────────────────────────────
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "frontend")
app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")


# ── Serve HTML pages ──────────────────────────────────────────
@app.get("/")
def serve_root(request: Request):
    # If logged in, show boards list (index.html), else register
    if request.cookies.get("user_id"):
        return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))
    return RedirectResponse(url="/register")


@app.get("/register")
def serve_register():
    return FileResponse(os.path.join(FRONTEND_DIR, "register.html"))


@app.get("/login")
def serve_login():
    return FileResponse(os.path.join(FRONTEND_DIR, "login.html"))


@app.get("/board")
def serve_board(request: Request, id: Optional[str] = None):
    # If no ID provided, or not logged in, go back to boards list (root)
    if not request.cookies.get("user_id") or not id:
        return RedirectResponse(url="/")
    return FileResponse(os.path.join(FRONTEND_DIR, "board.html"))


# ── Startup ───────────────────────────────────────────────────
@app.on_event("startup")
def startup():
    create_tables()
    print("[OK] Database tables ready")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
