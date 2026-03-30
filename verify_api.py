import urllib.request
import json
import time

BASE_URL = "http://127.0.0.1:8000"

def test_api():
    print("Starting JWT-authenticated API verification...")
    
    # 0. Register & Login to get JWT
    username = f"tester_{int(time.time())}"
    password = "testpassword123"
    
    # Register
    reg_data = json.dumps({"username": username, "password": password}).encode('utf-8')
    reg_req = urllib.request.Request(f"{BASE_URL}/auth/register", data=reg_data, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(reg_req) as f:
        print(f"Registered user: {username}")

    # Login
    login_req = urllib.request.Request(f"{BASE_URL}/auth/login", data=reg_data, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(login_req) as f:
        login_res = json.loads(f.read().decode('utf-8'))
        token = login_res['access_token']
        print("Logged in, token received.")

    # Shared Auth Header
    auth_headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {token}'
    }

    # 1. Create Board
    board_data = json.dumps({"name": "JWT Test Board", "description": "Verified via Bearer Token"}).encode('utf-8')
    req = urllib.request.Request(f"{BASE_URL}/boards", data=board_data, headers=auth_headers)
    with urllib.request.urlopen(req) as f:
        board = json.loads(f.read().decode('utf-8'))
        board_id = board['id']
        print(f"Created Board ID: {board_id}")

    # 2. Get All Boards
    req = urllib.request.Request(f"{BASE_URL}/boards", headers=auth_headers)
    with urllib.request.urlopen(req) as f:
        boards_res = json.loads(f.read().decode('utf-8'))
        print(f"Total Boards listed: {boards_res['total']}")

    # 3. Create Task (with default status 'todo')
    task_data = json.dumps({"board_id": board_id, "title": "JWT Task", "description": "Secret task"}).encode('utf-8')
    req = urllib.request.Request(f"{BASE_URL}/tasks", data=task_data, headers=auth_headers)
    with urllib.request.urlopen(req) as f:
        task = json.loads(f.read().decode('utf-8'))
        task_id = task['id']
        print(f"Created Task ID: {task_id}, Status: {task['status']}")

    # 4. Get All Tasks
    req = urllib.request.Request(f"{BASE_URL}/tasks", headers=auth_headers)
    with urllib.request.urlopen(req) as f:
        tasks_res = json.loads(f.read().decode('utf-8'))
        print(f"Total Tasks listed: {tasks_res['total']}")

    # 5. Update Task
    update_data = json.dumps({"title": "Updated Secret Task"}).encode('utf-8')
    req = urllib.request.Request(f"{BASE_URL}/tasks/{task_id}", data=update_data, method='PUT', headers=auth_headers)
    with urllib.request.urlopen(req) as f:
        print("Updated Task successfully.")

    # 6. Delete Task
    req = urllib.request.Request(f"{BASE_URL}/tasks/{task_id}", method='DELETE', headers=auth_headers)
    with urllib.request.urlopen(req) as f:
        print("Deleted Task.")

    # 7. Delete Board
    req = urllib.request.Request(f"{BASE_URL}/boards/{board_id}", method='DELETE', headers=auth_headers)
    with urllib.request.urlopen(req) as f:
        print("Deleted Board.")

    print("--- API verification PASS with Bearer JWT! ---")

if __name__ == "__main__":
    try:
        test_api()
    except Exception as e:
        print(f"Verification FAILED: {e}")
