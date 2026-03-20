"""
Full CRUD test for Boards + Tasks - Windows compatible
Runs against a live server at http://localhost:8000
"""
import requests, time, sys

BASE = "http://localhost:8000"
ts = int(time.time())
USERNAME = f"crudtest_{ts}"
PASSWORD = "testpass123"

errors = []

def check(label, cond, got=""):
    status = "PASS" if cond else "FAIL"
    print(f"  [{status}] {label}")
    if not cond:
        print(f"         Got: {str(got)[:200]}")
        errors.append(label)

# ── Auth ──────────────────────────────────────────────────────
print("\n=== AUTH ===")
r = requests.post(f"{BASE}/auth/register", json={"username": USERNAME, "password": PASSWORD})
check("Register (200)", r.status_code == 200, r.text)

r = requests.post(f"{BASE}/auth/login", json={"username": USERNAME, "password": PASSWORD})
check("Login (200)", r.status_code == 200, r.text)
cookies = r.cookies
check("Cookie user_id set", "user_id" in cookies, dict(cookies))

# ── Boards CRUD ───────────────────────────────────────────────
print("\n=== BOARDS ===")

# CREATE
r = requests.post(f"{BASE}/boards", json={"name": "Board A", "description": "First board"}, cookies=cookies)
check("Create board (201)", r.status_code == 201, r.text)
board_a = r.json()
board_id = board_a.get("id")
check("Create returns id", board_id is not None, r.text)

# CREATE second board (for move task / merge tests)
r2 = requests.post(f"{BASE}/boards", json={"name": "Board B", "description": "Second board"}, cookies=cookies)
check("Create second board (201)", r2.status_code == 201, r2.text)
board_b_id = r2.json().get("id")

# READ ALL
r = requests.get(f"{BASE}/boards", cookies=cookies)
check("List boards (200)", r.status_code == 200, r.text)
check("List returns >= 2 boards", len(r.json()) >= 2, r.text)

# READ ONE
r = requests.get(f"{BASE}/boards/{board_id}", cookies=cookies)
check("Get one board (200)", r.status_code == 200, r.text)
check("Get board name matches", r.json().get("name") == "Board A", r.text)

# UPDATE
r = requests.put(f"{BASE}/boards/{board_id}", json={"name": "Board A Updated"}, cookies=cookies)
check("Update board (200)", r.status_code == 200, r.text)
check("Update name reflected", r.json().get("name") == "Board A Updated", r.text)

# AUTH ISOLATION - other user should NOT see boards
other_reg = requests.post(f"{BASE}/auth/register", json={"username": f"other_{ts}", "password": PASSWORD})
other_login = requests.post(f"{BASE}/auth/login", json={"username": f"other_{ts}", "password": PASSWORD})
other_cookies = other_login.cookies
r = requests.get(f"{BASE}/boards", cookies=other_cookies)
check("Other user sees 0 boards", len(r.json()) == 0, r.text)
r = requests.get(f"{BASE}/boards/{board_id}", cookies=other_cookies)
check("Other user cannot get board (404)", r.status_code == 404, r.text)

# ── Tasks CRUD ────────────────────────────────────────────────
print("\n=== TASKS ===")

# CREATE task
r = requests.post(f"{BASE}/tasks",
    json={"board_id": board_id, "title": "Task 1", "description": "Do stuff", "status": "todo"},
    cookies=cookies)
check("Create task (201)", r.status_code == 201, r.text)
task = r.json()
task_id = task.get("id")
check("Create task returns id", task_id is not None, r.text)
check("Create task status = todo", task.get("status") == "todo", r.text)

# GET all tasks for board
r = requests.get(f"{BASE}/tasks?board_id={board_id}", cookies=cookies)
check("List tasks for board (200)", r.status_code == 200, r.text)
check("List returns >= 1 task", len(r.json()) >= 1, r.text)

# GET single task
r = requests.get(f"{BASE}/tasks/{task_id}", cookies=cookies)
check("Get single task (200)", r.status_code == 200, r.text)
check("Task title matches", r.json().get("title") == "Task 1", r.text)

# UPDATE task
r = requests.put(f"{BASE}/tasks/{task_id}",
    json={"title": "Task 1 Updated", "status": "doing"},
    cookies=cookies)
check("Update task (200)", r.status_code == 200, r.text)
check("Update reflects new title", r.json().get("title") == "Task 1 Updated", r.text)
check("Update reflects new status = doing", r.json().get("status") == "doing", r.text)

# MOVE via /move endpoint
r = requests.put(f"{BASE}/tasks/{task_id}/move", json={"status": "done"}, cookies=cookies)
check("Move task to done (200)", r.status_code == 200, r.text)
check("Move status = done", r.json().get("status") == "done", r.text)

# MOVE to invalid status
r = requests.put(f"{BASE}/tasks/{task_id}/move", json={"status": "invalid_status"}, cookies=cookies)
check("Move to invalid status (400)", r.status_code == 400, r.text)

# MOVE task to another board
r = requests.put(f"{BASE}/tasks/{task_id}", json={"board_id": board_b_id}, cookies=cookies)
check("Move task to Board B (200)", r.status_code == 200, r.text)
check("Task board_id is now Board B", r.json().get("board_id") == board_b_id, r.text)

# DELETE task
r = requests.delete(f"{BASE}/tasks/{task_id}", cookies=cookies)
check("Delete task (200)", r.status_code == 200, r.text)
r = requests.get(f"{BASE}/tasks/{task_id}", cookies=cookies)
check("Deleted task returns 404", r.status_code == 404, r.text)

# ── Board Delete ──────────────────────────────────────────────
print("\n=== BOARD DELETE ===")
r = requests.delete(f"{BASE}/boards/{board_id}", cookies=cookies)
check("Delete Board A (200)", r.status_code == 200, r.text)
r = requests.get(f"{BASE}/boards/{board_id}", cookies=cookies)
check("Deleted board returns 404", r.status_code == 404, r.text)
r = requests.delete(f"{BASE}/boards/{board_b_id}", cookies=cookies)
check("Delete Board B (200)", r.status_code == 200, r.text)

# ── Summary ───────────────────────────────────────────────────
print(f"\n{'='*44}")
if errors:
    print(f"  FAILED {len(errors)} check(s):")
    for e in errors:
        print(f"    FAIL  {e}")
    sys.exit(1)
else:
    print("  ALL CHECKS PASSED")
