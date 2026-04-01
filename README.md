# Kanban Boards — Kanban Board App

A full-stack Kanban board web application built with **FastAPI**, **Neon PostgreSQL**, and vanilla **HTML/CSS/JS**.

---

## Project Structure

```
kanban-project/
├── .env                        # Neon DB connection string
├── requirements.txt
├── backend/
│   ├── main.py                 # FastAPI app entry point
│   ├── db.py                   # Database connection + table setup
│   ├── models.py               # Pydantic models
│   └── routers/
│       ├── boards.py           # Board CRUD routes
│       └── tasks.py            # Task CRUD + move routes
└── frontend/
    ├── index.html              # Boards list page
    ├── board.html              # Board detail + Kanban columns
    ├── style.css               # Dark-mode glassmorphism styles
    ├── script.js               # Boards page JS
    └── board.js                # Board detail + drag & drop JS
```

---

##  Setup

### 1. Configure Neon DB
Edit `.env` and replace with your actual Neon connection string:
```
DATABASE_URL=postgresql://user:password@ep-xxxx.neon.tech/neondb?sslmode=require
```

### 2. Install dependencies
```bash
cd kanban-project
pip install -r requirements.txt
```

### 3. Run the server
```bash
cd backend
uvicorn main:app --reload --port 8000
```

### 4. Open in browser
```
http://localhost:8000
```

---

## API Reference

### Boards
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/boards` | Create a board |
| `GET` | `/boards` | List all boards |
| `GET` | `/boards/{id}` | Get single board |
| `DELETE` | `/boards/{id}` | Delete board + its tasks |

### Tasks
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/tasks` | Create a task |
| `GET` | `/tasks` | List all tasks (add `?board_id=X` to filter) |
| `PUT` | `/tasks/{id}` | Update task (title/desc/status) |
| `DELETE` | `/tasks/{id}` | Delete a task |
| `PUT` | `/tasks/{id}/move` | Move task to column |

### Status values: `todo` · `doing` · `done`

---

## Postman Testing

Start server, then import these requests:

**Create Board**
```
POST http://localhost:8000/boards
Body: { "name": "Sprint 1", "description": "First sprint" }
```

**Create Task**
```
POST http://localhost:8000/tasks
Body: { "board_id": 1, "title": "Fix bug", "status": "todo" }
```

**Move Task to Doing**
```
PUT http://localhost:8000/tasks/1/move
Body: { "status": "doing" }
```

**Update Task**
```
PUT http://localhost:8000/tasks/1
Body: { "status": "done" }
```

---

## Features

- Create, view, delete boards
- Create, move, delete tasks across 3 columns (Todo / Doing / Done)
- Drag-and-drop task cards between columns
- Neon PostgreSQL storage with cascade delete
- Dark-mode glassmorphism UI with micro-animations
- Interactive Swagger docs at `/docs`
