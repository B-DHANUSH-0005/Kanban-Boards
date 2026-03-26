from fastapi import APIRouter, HTTPException, Query, Request, Depends
from db import get_connection
from models import TaskCreate, TaskUpdate, TaskMove, TaskResponse
from typing import List, Optional

router = APIRouter(prefix="/tasks", tags=["Tasks"])

VALID_STATUSES = {"todo", "doing", "done", "to do"}

def get_current_user_id(request: Request):
    user_id = request.cookies.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return int(user_id)


# ── POST /tasks ── Create a new task ─────────────────────────
@router.post("", response_model=TaskResponse, status_code=201)
def create_task(task: TaskCreate, user_id: int = Depends(get_current_user_id)):
    if task.status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail=f"Status must be one of {VALID_STATUSES}")

    from db import db_conn
    with db_conn() as conn:
        cur = conn.cursor()

        # Verify board exists AND belongs to the user
        cur.execute("SELECT id FROM boards WHERE id = %s AND user_id = %s", (task.board_id, user_id))
        if not cur.fetchone():
            cur.close()
            raise HTTPException(status_code=404, detail="Board not found or unauthorized")

        cur.execute(
            "INSERT INTO tasks (board_id, title, description, status) VALUES (%s, %s, %s, %s) "
            "RETURNING id, board_id, title, description, status, created_at",
            (task.board_id, task.title, task.description, task.status)
        )
        row = cur.fetchone()
        conn.commit()
        cur.close()
    return {"message": "Task created successfully!", "id": row[0], "board_id": row[1], "title": row[2],
            "description": row[3], "status": row[4], "created_at": row[5]}


# ── GET /tasks ── List all tasks (optionally filter by board) ─
@router.get("", response_model=List[TaskResponse])
def get_tasks(board_id: Optional[int] = Query(None), user_id: int = Depends(get_current_user_id)):
    from db import db_conn
    with db_conn() as conn:
        cur = conn.cursor()
        
        if board_id is not None:
            # Verify board ownership
            cur.execute("SELECT id FROM boards WHERE id = %s AND user_id = %s", (board_id, user_id))
            if not cur.fetchone():
                cur.close()
                raise HTTPException(status_code=404, detail="Board not found or unauthorized")
                
            cur.execute(
                "SELECT id, board_id, title, description, status, created_at "
                "FROM tasks WHERE board_id = %s ORDER BY created_at DESC",
                (board_id,)
            )
        else:
            # If no board_id, only show tasks from boards the user owns
            cur.execute(
                "SELECT t.id, t.board_id, t.title, t.description, t.status, t.created_at "
                "FROM tasks t JOIN boards b ON t.board_id = b.id WHERE b.user_id = %s ORDER BY t.created_at DESC",
                (user_id,)
            )
            
        rows = cur.fetchall()
        cur.close()
    return [
        {"id": r[0], "board_id": r[1], "title": r[2],
         "description": r[3], "status": r[4], "created_at": r[5]}
        for r in rows
    ]


# ── GET /tasks/{id} ── Get a single task ─────────────────────
@router.get("/{task_id}", response_model=TaskResponse)
def get_task(task_id: int, user_id: int = Depends(get_current_user_id)):
    from db import db_conn
    with db_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT t.id, t.board_id, t.title, t.description, t.status, t.created_at "
            "FROM tasks t JOIN boards b ON t.board_id = b.id WHERE t.id = %s AND b.user_id = %s",
            (task_id, user_id)
        )
        row = cur.fetchone()
        cur.close()
    if not row:
        raise HTTPException(status_code=404, detail="Task not found or unauthorized")
    return {
        "id": row[0], "board_id": row[1], "title": row[2],
        "description": row[3], "status": row[4], "created_at": row[5]
    }


# ── PUT /tasks/{id} ── Update a task (title, description, status)
@router.put("/{task_id}", response_model=TaskResponse)
def update_task(task_id: int, task: TaskUpdate, user_id: int = Depends(get_current_user_id)):
    from db import db_conn
    with db_conn() as conn:
        cur = conn.cursor()

        # Verify task exists and belongs to a board the user owns
        cur.execute(
            "SELECT t.id, t.board_id, t.title, t.description, t.status, t.created_at "
            "FROM tasks t JOIN boards b ON t.board_id = b.id WHERE t.id = %s AND b.user_id = %s",
            (task_id, user_id)
        )
        row = cur.fetchone()
        if not row:
            cur.close()
            raise HTTPException(status_code=404, detail="Task not found or unauthorized")

        # Merge existing values with updated ones
        new_title       = task.title       if task.title       is not None else row[2]
        new_description = task.description if task.description is not None else row[3]
        new_status      = task.status      if task.status      is not None else row[4]
        new_board_id    = task.board_id    if task.board_id    is not None else row[1]

        if new_status not in VALID_STATUSES:
            cur.close()
            raise HTTPException(status_code=400, detail=f"Status must be one of {VALID_STATUSES}")

        # If moving to another board, verify ownership of that board too
        if new_board_id != row[1]:
            cur.execute("SELECT id FROM boards WHERE id = %s AND user_id = %s", (new_board_id, user_id))
            if not cur.fetchone():
                cur.close()
                raise HTTPException(status_code=404, detail="Target board not found or unauthorized")

        cur.execute(
            "UPDATE tasks SET title=%s, description=%s, status=%s, board_id=%s WHERE id=%s "
            "RETURNING id, board_id, title, description, status, created_at",
            (new_title, new_description, new_status, new_board_id, task_id)
        )
        updated = cur.fetchone()
        conn.commit()
        cur.close()
    return {"message": "Task updated successfully!", "id": updated[0], "board_id": updated[1], "title": updated[2],
            "description": updated[3], "status": updated[4], "created_at": updated[5]}


# ── DELETE /tasks/{id} ── Delete a task ──────────────────────
@router.delete("/{task_id}")
def delete_task(task_id: int, user_id: int = Depends(get_current_user_id)):
    from db import db_conn
    with db_conn() as conn:
        cur = conn.cursor()
        # Verify ownership
        cur.execute(
            "SELECT t.id FROM tasks t JOIN boards b ON t.board_id = b.id WHERE t.id = %s AND b.user_id = %s",
            (task_id, user_id)
        )
        if not cur.fetchone():
            cur.close()
            raise HTTPException(status_code=404, detail="Task not found or unauthorized")
        
        cur.execute("DELETE FROM tasks WHERE id = %s", (task_id,))
        conn.commit()
        cur.close()
    return {"message": f"Task {task_id} deleted successfully"}


# ── PUT /tasks/{id}/move ── Move task to a column ────────────
@router.put("/{task_id}/move", response_model=TaskResponse)
def move_task(task_id: int, move: TaskMove, user_id: int = Depends(get_current_user_id)):

    if move.status not in VALID_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Status must be one of {VALID_STATUSES}"
        )

    from db import db_conn
    with db_conn() as conn:
        cur = conn.cursor()
        # Verify ownership
        cur.execute(
            "SELECT t.id FROM tasks t JOIN boards b ON t.board_id = b.id WHERE t.id = %s AND b.user_id = %s",
            (task_id, user_id)
        )
        if not cur.fetchone():
            cur.close()
            raise HTTPException(status_code=404, detail="Task not found or unauthorized")

        cur.execute(
            """UPDATE tasks 
               SET status=%s 
               WHERE id=%s
               RETURNING id, board_id, title, description, status, created_at""",
            (move.status, task_id)
        )
        row = cur.fetchone()

        if not row:
            cur.close()
            raise HTTPException(status_code=404, detail="Task not found")

        conn.commit()
        cur.close()

    columns = ["id", "board_id", "title", "description", "status", "created_at"]
    task = dict(zip(columns, row))

    return {
        "message": f"Task moved to {move.status} successfully!",
        **task
    }