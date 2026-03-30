import requests
import time

API_URL = "http://localhost:8000"

def test_auth_and_boards():
    # Use a unique username for each test run to avoid "already registered" error
    username = f"testuser_{int(time.time())}"
    password = "testpassword123"

    print(f"--- Starting JWT Auth & Filtering tests: {username} ---")

    # 1. Register
    reg_res = requests.post(f"{API_URL}/auth/register", json={"username": username, "password": password})
    print(f"Register: {reg_res.status_code}")
    assert reg_res.status_code == 201

    # 2. Login
    login_res = requests.post(f"{API_URL}/auth/login", json={"username": username, "password": password})
    print(f"Login: {login_res.status_code}")
    assert login_res.status_code == 200
    
    token = login_res.json()["access_token"]
    auth_headers = {"Authorization": f"Bearer {token}"}

    # 3. Create Board (with JWT)
    board_data = {"name": "Test Board", "description": "Verification board"}
    create_res = requests.post(f"{API_URL}/boards", json=board_data, headers=auth_headers)
    print(f"Create Board: {create_res.status_code}")
    assert create_res.status_code == 201
    board_id = create_res.json()["id"]

    # 4. Get Boards (paginated response)
    get_res = requests.get(f"{API_URL}/boards", headers=auth_headers)
    items = get_res.json()["items"]
    print(f"Get Boards: {get_res.status_code} - Found {len(items)} board(s)")
    assert get_res.status_code == 200
    assert len(items) >= 1

    # 5. Create another user and verify they can't see the board
    other_username = f"otheruser_{int(time.time())}"
    requests.post(f"{API_URL}/auth/register", json={"username": other_username, "password": password})
    other_login = requests.post(f"{API_URL}/auth/login", json={"username": other_username, "password": password})
    other_token = other_login.json()["access_token"]
    other_headers = {"Authorization": f"Bearer {other_token}"}
    
    other_get_res = requests.get(f"{API_URL}/boards", headers=other_headers)
    other_items = other_get_res.json()["items"]
    print(f"Other User Get Boards: {len(other_items)} boards found (Expected 0)")
    assert len(other_items) == 0

    print("--- Backend JWT Auth & Filtering Tests Passed! ---")

if __name__ == "__main__":
    try:
        test_auth_and_boards()
    except Exception as e:
        print(f"Tests failed: {e}")
        import traceback
        traceback.print_exc()
