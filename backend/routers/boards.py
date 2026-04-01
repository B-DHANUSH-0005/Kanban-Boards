"""
routers/boards.py — CRUD + merge + bundle for boards, with pagination.
Authentication via JWT Bearer token (shared dependency from security.py).
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import Optional
from math import ceil

from db import db_conn
from models import (
    BoardCreate, BoardUpdate, BoardMerge,
    BoardResponse, PaginatedResponse,
)
from security import get_current_user_id
from config import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE

router = APIRouter(prefix="/boards", tags=["Boards"])


# ── Internal Helpers ──────────────────────────────────────────
def _row_to_board(row: tuple) -> dict:
    """Standardized conversion from DB row to board dict."""
    return {
        "id": row[0], "name": row[1],
        "description": row[2],
        "columns": row[3].split(",") if row[3] else [],
        "deleted_columns": row[4].split(",") if row[4] else [],
        "created_at": row[5],
    }


def _assert_board_exists(cur, board_id: int, user_id: int) -> tuple:
    """Raise 404 if board not found or not owned by user. Returns the row."""
    cur.execute(
        "SELECT id, name, description, columns, deleted_columns, created_at"
        " FROM boards WHERE id = %s AND user_id = %s",
        (board_id, user_id),
    )
    row = cur.fetchone()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Board not found or you don't have access.",
        )
    return row


# ── POST /boards ── Create a board ───────────────────────────
@router.post(
    "",
    response_model=BoardResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new board",
)
def create_board(
    board: BoardCreate,
    user_id: int = Depends(get_current_user_id),
) -> dict:
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO boards (name, description, user_id)"
                " VALUES (%s, %s, %s)"
                " RETURNING id, name, description, columns, deleted_columns, created_at",
                (board.name, board.description, user_id),
            )
            row = cur.fetchone()
            conn.commit()

    return {"message": "Board created successfully!", **_row_to_board(row)}


# ── GET /boards ── Paginated board list ───────────────────────
@router.get(
    "",
    summary="List boards (paginated)",
)
def get_boards(
    page: int = Query(default=1, ge=1, description="Page number"),
    page_size: int = Query(default=DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE),
    search: Optional[str] = Query(default=None, description="Filter boards by name"),
    user_id: int = Depends(get_current_user_id),
) -> dict:
    offset = (page - 1) * page_size
    
    # Use efficient single connection for both count and fetch
    with db_conn() as conn:
        with conn.cursor() as cur:
            if search:
                like = f"%{search.strip()}%"
                cur.execute(
                    "SELECT COUNT(*) FROM boards WHERE user_id = %s AND name ILIKE %s",
                    (user_id, like),
                )
                total = cur.fetchone()[0]
                cur.execute(
                    "SELECT id, name, description, columns, deleted_columns, created_at"
                    " FROM boards WHERE user_id = %s AND name ILIKE %s"
                    " ORDER BY created_at DESC LIMIT %s OFFSET %s",
                    (user_id, like, page_size, offset),
                )
            else:
                cur.execute("SELECT COUNT(*) FROM boards WHERE user_id = %s", (user_id,))
                total = cur.fetchone()[0]
                cur.execute(
                    "SELECT id, name, description, columns, deleted_columns, created_at"
                    " FROM boards WHERE user_id = %s"
                    " ORDER BY created_at DESC LIMIT %s OFFSET %s",
                    (user_id, page_size, offset),
                )
            
            rows = cur.fetchall()

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": ceil(total / page_size) if total else 1,
        "items": [_row_to_board(r) for r in rows],
    }


# ── GET /boards/{board_id} ── Single board ────────────────────
@router.get(
    "/{board_id}",
    response_model=BoardResponse,
    summary="Get a single board",
)
def get_board(
    board_id: int,
    user_id: int = Depends(get_current_user_id),
) -> dict:
    with db_conn() as conn:
        with conn.cursor() as cur:
            row = _assert_board_exists(cur, board_id, user_id)
    return _row_to_board(row)


# ── PUT /boards/{board_id} ── Update board ────────────────────
@router.put(
    "/{board_id}",
    response_model=BoardResponse,
    summary="Update a board's name or description",
)
def update_board(
    board_id: int,
    board: BoardUpdate,
    user_id: int = Depends(get_current_user_id),
) -> dict:
    with db_conn() as conn:
        with conn.cursor() as cur:
            row = _assert_board_exists(cur, board_id, user_id)

            new_name = board.name if board.name is not None else row[1]
            new_desc = board.description if board.description is not None else row[2]
            
            # Dynamic columns update
            new_cols = ",".join(board.columns) if board.columns is not None else row[3]
            new_deleted = ",".join(board.deleted_columns) if board.deleted_columns is not None else row[4]

            cur.execute(
                "UPDATE boards SET name = %s, description = %s, columns = %s, deleted_columns = %s WHERE id = %s"
                " RETURNING id, name, description, columns, deleted_columns, created_at",
                (new_name, new_desc, new_cols, new_deleted, board_id),
            )
            updated = cur.fetchone()
            conn.commit()

    return {"message": "Board updated successfully!", **_row_to_board(updated)}


# ── DELETE /boards/{board_id} ── Delete board ─────────────────
@router.delete(
    "/{board_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete a board and all its tasks",
)
def delete_board(
    board_id: int,
    user_id: int = Depends(get_current_user_id),
) -> dict:
    with db_conn() as conn:
        with conn.cursor() as cur:
            _assert_board_exists(cur, board_id, user_id)
            cur.execute("DELETE FROM boards WHERE id = %s", (board_id,))
            conn.commit()

    return {"message": "Board deleted successfully."}


# ── POST /boards/{board_id}/merge ── Merge into another board ─
@router.post(
    "/{board_id}/merge",
    summary="Move all tasks from this board into another board",
)
def merge_board(
    board_id: int,
    merge: BoardMerge,
    user_id: int = Depends(get_current_user_id),
) -> dict:
    if board_id == merge.target_board_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot merge a board into itself.")

    with db_conn() as conn:
        with conn.cursor() as cur:
            # Efficiently verify both boards exist for this user in one query
            cur.execute(
                "SELECT id, columns FROM boards WHERE id = ANY(%s) AND user_id = %s",
                ([board_id, merge.target_board_id], user_id),
            )
            rows = cur.fetchall()
            if len(rows) < 2:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="One or both boards not found or you don't have access.",
                )

            source_cols = ""
            target_cols = ""
            for r in rows:
                if r[0] == board_id:
                    source_cols = r[1] or ""
                else:
                    target_cols = r[1] or ""

            s_cols = source_cols.split(",") if source_cols else []
            t_cols = target_cols.split(",") if target_cols else []
            
            merged_cols = list(t_cols)
            for col in s_cols:
                if col not in merged_cols:
                    merged_cols.append(col)
                    
            merged_cols_str = ",".join(merged_cols)

            # Atomic move and delete
            cur.execute("UPDATE tasks SET board_id = %s WHERE board_id = %s", (merge.target_board_id, board_id))
            cur.execute("UPDATE boards SET columns = %s WHERE id = %s", (merged_cols_str, merge.target_board_id))
            cur.execute("DELETE FROM boards WHERE id = %s", (board_id,))
            conn.commit()

    return {"message": "Boards merged successfully."}


# ── GET /boards/{board_id}/bundle ── Full board data ──────────
@router.get(
    "/{board_id}/bundle",
    summary="Fetch board info + tasks + all board names in one request",
)
def get_board_bundle(
    board_id: int,
    user_id: int = Depends(get_current_user_id),
) -> dict:
    with db_conn() as conn:
        with conn.cursor() as cur:
            # 1 — Board info
            board_row = _assert_board_exists(cur, board_id, user_id)

            # 2 — Tasks for this board (ordered newest first)
            cur.execute(
                "SELECT id, board_id, title, description, status, created_at"
                " FROM tasks WHERE board_id = %s ORDER BY created_at DESC",
                (board_id,),
            )
            task_rows = cur.fetchall()

            # 3 — All board names for menus (reusable sidebar/merge data)
            cur.execute(
                "SELECT id, name FROM boards WHERE user_id = %s ORDER BY created_at DESC",
                (user_id,),
            )
            all_board_rows = cur.fetchall()

    return {
        "board": _row_to_board(board_row),
        "tasks": [
            {
                "id": r[0], "board_id": r[1], "title": r[2],
                "description": r[3], "status": r[4], "created_at": r[5],
            }
            for r in task_rows
        ],
        "all_boards": [{"id": r[0], "name": r[1]} for r in all_board_rows],
    }
