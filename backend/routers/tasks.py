"""
routers/tasks.py — CRUD + move for tasks, with pagination.
Authentication via JWT Bearer token (shared dependency from security.py).
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import Optional
from math import ceil

from db import db_conn
from models import TaskCreate, TaskUpdate, TaskMove, TaskResponse
from security import get_current_user_id
from config import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, VALID_TASK_STATUSES

router = APIRouter(prefix="/tasks", tags=["Tasks"])


# ── Internal Helpers ──────────────────────────────────────────
def _row_to_task(row: tuple) -> dict:
    """Standardized conversion from DB row to task dict."""
    return {
        "id": row[0], "board_id": row[1], "title": row[2],
        "description": row[3], "status": row[4], "created_at": row[5],
    }


def _assert_board_ownership(cur, board_id: int, user_id: int) -> list[str]:
    """Verify board exists and belongs to user. Returns list of active columns."""
    cur.execute(
        "SELECT columns FROM boards WHERE id = %s AND user_id = %s",
        (board_id, user_id),
    )
    row = cur.fetchone()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Board not found or you don't have access.",
        )
    return row[0].split(",") if row[0] else []


def _assert_task_ownership(cur, task_id: int, user_id: int) -> tuple:
    """Verify task belongs to user's board. Returns the task row."""
    cur.execute(
        "SELECT t.id, t.board_id, t.title, t.description, t.status, t.created_at"
        " FROM tasks t JOIN boards b ON t.board_id = b.id"
        " WHERE t.id = %s AND b.user_id = %s",
        (task_id, user_id),
    )
    row = cur.fetchone()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found or you don't have access.",
        )
    return row


# ── POST /tasks ── Create task ────────────────────────────────
@router.post(
    "",
    response_model=TaskResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new task on a board",
)
def create_task(
    task: TaskCreate,
    user_id: int = Depends(get_current_user_id),
) -> dict:
    with db_conn() as conn:
        with conn.cursor() as cur:
            columns = _assert_board_ownership(cur, task.board_id, user_id)
            
            if task.status not in columns:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Status '{task.status}' is not valid for this board. Valid: {', '.join(columns)}",
                )

            cur.execute(
                "INSERT INTO tasks (board_id, title, description, status)"
                " VALUES (%s, %s, %s, %s)"
                " RETURNING id, board_id, title, description, status, created_at",
                (task.board_id, task.title, task.description, task.status),
            )
            row = cur.fetchone()
            conn.commit()

    return {"message": "Task created successfully!", **_row_to_task(row)}


# ── GET /tasks ── List tasks (paginated) ──────────────────────
@router.get(
    "",
    summary="List tasks (paginated). Filter by board_id or status.",
)
def get_tasks(
    board_id: Optional[int] = Query(default=None, description="Filter by board"),
    filter_status: Optional[str] = Query(default=None, alias="status"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE),
    user_id: int = Depends(get_current_user_id),
) -> dict:
    # Status filter is now dynamic per board if board_id is provided,
    # but for global list we skip validation or check against a master list.
    # Given the app structure, task list is usually scoped to a board.

    offset = (page - 1) * page_size

    with db_conn() as conn:
        with conn.cursor() as cur:
            # Dynamically build query parts for performance and security
            base_query = " FROM tasks t JOIN boards b ON t.board_id = b.id WHERE b.user_id = %s"
            params = [user_id]

            if board_id is not None:
                _assert_board_ownership(cur, board_id, user_id)
                base_query += " AND t.board_id = %s"
                params.append(board_id)
            
            if filter_status:
                base_query += " AND t.status = %s"
                params.append(filter_status)

            # Count total
            cur.execute(f"SELECT COUNT(*){base_query}", tuple(params))
            total = cur.fetchone()[0]

            # Fetch items
            cur.execute(
                f"SELECT t.id, t.board_id, t.title, t.description, t.status, t.created_at"
                f"{base_query} ORDER BY t.created_at DESC LIMIT %s OFFSET %s",
                tuple(params + [page_size, offset])
            )
            rows = cur.fetchall()

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": ceil(total / page_size) if total else 1,
        "items": [_row_to_task(r) for r in rows],
    }


# ── GET /tasks/{task_id} ── Single task ───────────────────────
@router.get(
    "/{task_id}",
    response_model=TaskResponse,
    summary="Get a single task by ID",
)
def get_task(
    task_id: int,
    user_id: int = Depends(get_current_user_id),
) -> dict:
    with db_conn() as conn:
        with conn.cursor() as cur:
            row = _assert_task_ownership(cur, task_id, user_id)
    return _row_to_task(row)


# ── PUT /tasks/{task_id} ── Update task ───────────────────────
@router.put(
    "/{task_id}",
    response_model=TaskResponse,
    summary="Update a task's title, description, status, or board",
)
def update_task(
    task_id: int,
    task: TaskUpdate,
    user_id: int = Depends(get_current_user_id),
) -> dict:
    with db_conn() as conn:
        with conn.cursor() as cur:
            row = _assert_task_ownership(cur, task_id, user_id)

            new_title       = task.title       if task.title       is not None else row[2]
            new_description = task.description if task.description is not None else row[3]
            new_status      = task.status      if task.status      is not None else row[4]
            new_board_id    = task.board_id    if task.board_id    is not None else row[1]

            if new_board_id != row[1] or task.status is not None:
                columns = _assert_board_ownership(cur, new_board_id, user_id)
                if new_board_id != row[1]:
                    # On board transfer, place the task into the target's default column
                    default_status = "todo" if "todo" in columns else (columns[0] if columns else None)
                    if default_status is None:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Target board has no columns configured.",
                        )
                    new_status = default_status
                elif new_status not in columns:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Status '{new_status}' is not valid for this board. Valid: {', '.join(columns)}",
                    )

            cur.execute(
                "UPDATE tasks SET title = %s, description = %s, status = %s, board_id = %s"
                " WHERE id = %s"
                " RETURNING id, board_id, title, description, status, created_at",
                (new_title, new_description, new_status, new_board_id, task_id),
            )
            updated = cur.fetchone()
            conn.commit()

    return {"message": "Task updated successfully!", **_row_to_task(updated)}


# ── DELETE /tasks/{task_id} ── Delete task ────────────────────
@router.delete(
    "/{task_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete a task permanently",
)
def delete_task(
    task_id: int,
    user_id: int = Depends(get_current_user_id),
) -> dict:
    with db_conn() as conn:
        with conn.cursor() as cur:
            _assert_task_ownership(cur, task_id, user_id)
            cur.execute("DELETE FROM tasks WHERE id = %s", (task_id,))
            conn.commit()

    return {"message": "Task deleted successfully."}


# ── PUT /tasks/{task_id}/move ── Move task status ─────────────
@router.put(
    "/{task_id}/move",
    response_model=TaskResponse,
    summary="Move a task to a different status column",
)
def move_task(
    task_id: int,
    move: TaskMove,
    user_id: int = Depends(get_current_user_id),
) -> dict:
    with db_conn() as conn:
        with conn.cursor() as cur:
            task_row = _assert_task_ownership(cur, task_id, user_id)
            columns = _assert_board_ownership(cur, task_row[1], user_id)
            if move.status not in columns:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Status '{move.status}' is not valid for this board. Valid: {', '.join(columns)}",
                )

            cur.execute(
                "UPDATE tasks SET status = %s WHERE id = %s"
                " RETURNING id, board_id, title, description, status, created_at",
                (move.status, task_id),
            )
            row = cur.fetchone()
            conn.commit()

    return {"message": f"Task moved to '{move.status}' successfully!", **_row_to_task(row)}
