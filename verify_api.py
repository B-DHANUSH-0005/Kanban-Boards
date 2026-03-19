import urllib.request
import json
import time

BASE_URL = "http://127.0.0.1:8000"

def test_api():
    print("Starting API verification...")
    
    # 1. Create Board
    board_data = json.dumps({"name": "Test Board", "description": "Verification board"}).encode('utf-8')
    req = urllib.request.Request(f"{BASE_URL}/boards/", data=board_data, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req) as f:
        board = json.loads(f.read().decode('utf-8'))
        board_id = board['id']
        print(f"Created Board ID: {board_id}")

    # 2. Get All Boards
    with urllib.request.urlopen(f"{BASE_URL}/boards/") as f:
        boards = json.loads(f.read().decode('utf-8'))
        print(f"Total Boards: {len(boards)}")

    # 3. Create Task (with default status 'to do')
    task_data = json.dumps({"board_id": board_id, "title": "Test Task", "description": "Verify task creation"}).encode('utf-8')
    req = urllib.request.Request(f"{BASE_URL}/tasks/", data=task_data, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req) as f:
        task = json.loads(f.read().decode('utf-8'))
        task_id = task['id']
        print(f"Created Task ID: {task_id}, Status: {task['status']}")
        if task['status'] != "to do":
            print(f"ERROR: Expected status 'to do', got '{task['status']}'")

    # 4. Get All Tasks
    with urllib.request.urlopen(f"{BASE_URL}/tasks/") as f:
        tasks = json.loads(f.read().decode('utf-8'))
        print(f"Total Tasks: {len(tasks)}")

    # 5. Update Task
    update_data = json.dumps({"title": "Updated Test Task"}).encode('utf-8')
    req = urllib.request.Request(f"{BASE_URL}/tasks/{task_id}", data=update_data, method='PUT', headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req) as f:
        updated_task = json.loads(f.read().decode('utf-8'))
        print(f"Updated Task Title: {updated_task['title']}")

    # 6. Move Task (to 'doing')
    move_data = json.dumps({"status": "doing"}).encode('utf-8')
    req = urllib.request.Request(f"{BASE_URL}/tasks/{task_id}/move", data=move_data, method='PUT', headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req) as f:
        moved_task = json.loads(f.read().decode('utf-8'))
        print(f"Moved Task Status: {moved_task['status']}")

    # 7. Delete Task
    req = urllib.request.Request(f"{BASE_URL}/tasks/{task_id}", method='DELETE')
    with urllib.request.urlopen(req) as f:
        print(f"Deleted Task: {f.read().decode('utf-8')}")

    # 8. Delete Board
    req = urllib.request.Request(f"{BASE_URL}/boards/{board_id}", method='DELETE')
    with urllib.request.urlopen(req) as f:
        print(f"Deleted Board: {f.read().decode('utf-8')}")

    print("API verification completed successfully!")

if __name__ == "__main__":
    try:
        test_api()
    except Exception as e:
        print(f"Verification FAILED: {e}")
