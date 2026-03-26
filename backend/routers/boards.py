from fastapi import APIRouter, HTTPException, Request, Depends
from db import get_connection
from models import BoardCreate, BoardResponse, BoardUpdate, BoardMerge
from typing import List, Optional

router = APIRouter(prefix="/boards", tags=["Boards"])

def get_current_user_id(request: Request):
    user_id = request.cookies.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return int(user_id)

# ── POST /boards ── Create a new board ───────────────────────
@router.post("", response_model=BoardResponse, status_code=201)
def create_board(board: BoardCreate, user_id: int = Depends(get_current_user_id)):
    from db import db_conn
    with db_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO boards (name, description, user_id) VALUES (%s, %s, %s) RETURNING id, name, description, created_at",
            (board.name, board.description, user_id)
        )
        row = cur.fetchone()
        conn.commit()
        cur.close()
    return {
        "message": "Board created successfully!",
        "id": row[0],
        "name": row[1],
        "description": row[2],
        "created_at": row[3],
    }


# ── GET /boards ── List all boards (filtered by user) ────────
@router.get("", response_model=List[BoardResponse])
def get_boards(user_id: int = Depends(get_current_user_id)):
    from db import db_conn
    with db_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, name, description, created_at FROM boards WHERE user_id = %s ORDER BY created_at DESC",
            (user_id,)
        )
        rows = cur.fetchall()
        cur.close()
    return [
        {"id": r[0], "name": r[1], "description": r[2], "created_at": r[3]}
        for r in rows
    ]


# ── GET /boards/{id} ── Get single board ─────────────────────
@router.get("/{board_id}", response_model=BoardResponse)
def get_board(board_id: int, user_id: int = Depends(get_current_user_id)):
    from db import db_conn
    with db_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, name, description, created_at FROM boards WHERE id = %s AND user_id = %s",
            (board_id, user_id)
        )
        row = cur.fetchone()
        cur.close()
    if not row:
        raise HTTPException(status_code=404, detail="Board not found")
    return {
        "message": "Board retrieved successfully",
        "id": row[0],
        "name": row[1],
        "description": row[2],
        "created_at": row[3]
    }


# ── DELETE /boards/{id} ── Delete a board ────────────────────
@router.delete("/{board_id}")
def delete_board(board_id: int, user_id: int = Depends(get_current_user_id)):
    from db import db_conn
    with db_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id FROM boards WHERE id = %s AND user_id = %s", (board_id, user_id))
        
        if not cur.fetchone():
            cur.close()
            raise HTTPException(status_code=404, detail="Board not found or unauthorized")
        
        cur.execute("DELETE FROM boards WHERE id = %s", (board_id,))
        conn.commit()
        cur.close()
    return {"message": f"Board {board_id} deleted successfully"}


# ── PUT /boards/{id} ── Update a board ───────────────────────
@router.put("/{board_id}", response_model=BoardResponse)
def update_board(board_id: int, board: BoardUpdate, user_id: int = Depends(get_current_user_id)):
    from db import db_conn
    with db_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id, name, description FROM boards WHERE id = %s AND user_id = %s", (board_id, user_id))
        
        row = cur.fetchone()
        if not row:
            cur.close()
            raise HTTPException(status_code=404, detail="Board not found or unauthorized")

        new_name = board.name if board.name is not None else row[1]
        new_desc = board.description if board.description is not None else row[2]

        cur.execute(
            "UPDATE boards SET name=%s, description=%s WHERE id=%s RETURNING id, name, description, created_at",
            (new_name, new_desc, board_id)
        )
        updated = cur.fetchone()
        conn.commit()
        cur.close()
    return {
        "message": "Board updated successfully!",
        "id": updated[0],
        "name": updated[1],
        "description": updated[2],
        "created_at": updated[3]
    }


# ── POST /boards/{id}/merge ── Merge current board into another ──
@router.post("/{board_id}/merge")
def merge_board(board_id: int, merge: BoardMerge, user_id: int = Depends(get_current_user_id)):
    if board_id == merge.target_board_id:
        raise HTTPException(status_code=400, detail="Cannot merge a board into itself")

    from db import db_conn
    with db_conn() as conn:
        cur = conn.cursor()
        # Verify both boards exist and belong to the user
        cur.execute("SELECT id FROM boards WHERE id IN (%s, %s) AND user_id = %s", (board_id, merge.target_board_id, user_id))
            
        if len(cur.fetchall()) < 2:
            cur.close()
            raise HTTPException(status_code=404, detail="One or both boards not found or unauthorized")

        # Move all tasks
        cur.execute("UPDATE tasks SET board_id = %s WHERE board_id = %s", (merge.target_board_id, board_id))
        
        # Delete source board
        cur.execute("DELETE FROM boards WHERE id = %s", (board_id,))
        
        conn.commit()
        cur.close()
    return {"message": f"Board {board_id} merged into {merge.target_board_id} successfully"}


# ── GET /boards/{id}/bundle ── Get full board data in one call ──
@router.get("/{board_id}/bundle")
def get_board_bundle(board_id: int, user_id: int = Depends(get_current_user_id)):
    """
    Returns board info, tasks for that board, and name list of all boards 
    (for the transfer menu) in a SINGLE database connection/request.
    """
    from db import db_conn
    with db_conn() as conn:
        cur = conn.cursor()
        
        # 1. Get Board Info
        cur.execute("SELECT id, name, description, created_at FROM boards WHERE id = %s AND user_id = %s", (board_id, user_id))
        board_row = cur.fetchone()
        if not board_row:
            cur.close()
            raise HTTPException(status_code=404, detail="Board not found")
        
        # 2. Get Tasks for this core board
        cur.execute("SELECT id, board_id, title, description, status, created_at FROM tasks WHERE board_id = %s ORDER BY created_at DESC", (board_id,))
        task_rows = cur.fetchall()
        
        # 3. Get All Boards (for board transfer list)
        cur.execute("SELECT id, name FROM boards WHERE user_id = %s ORDER BY created_at DESC", (user_id,))
        all_boards_rows = cur.fetchall()
        
        bundle = {
            "board": {"id": board_row[0], "name": board_row[1], "description": board_row[2], "created_at": board_row[3]},
            "tasks": [{"id": r[0], "board_id": r[1], "title": r[2], "description": r[3], "status": r[4], "created_at": r[5]} for r in task_rows],
            "all_boards": [{"id": r[0], "name": r[1]} for r in all_boards_rows]
        }
        cur.close()
    return bundle
