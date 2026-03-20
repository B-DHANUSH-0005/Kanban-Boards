import requests
import time

API_URL = "http://localhost:8000"

def test_auth_and_boards():
    # Use a unique username for each test run to avoid "already registered" error
    username = f"testuser_{int(time.time())}"
    password = "testpassword"

    print(f"--- Starting tests with user: {username} ---")

    # 1. Register
    reg_res = requests.post(f"{API_URL}/auth/register", json={"username": username, "password": password})
    print(f"Register: {reg_res.status_code} - {reg_res.json()}")
    assert reg_res.status_code == 200

    # 2. Login
    login_res = requests.post(f"{API_URL}/auth/login", json={"username": username, "password": password})
    print(f"Login: {login_res.status_code} - {login_res.json()}")
    assert login_res.status_code == 200
    cookies = login_res.cookies

    # 3. Create Board
    board_data = {"name": "Test Board", "description": "Verification board"}
    create_res = requests.post(f"{API_URL}/boards", json=board_data, cookies=cookies)
    print(f"Create Board: {create_res.status_code} - {create_res.json()}")
    assert create_res.status_code == 201
    board_id = create_res.json()["id"]

    # 4. Get Boards (should see 1 board)
    get_res = requests.get(f"{API_URL}/boards", cookies=cookies)
    print(f"Get Boards: {get_res.status_code} - {len(get_res.json())} boards found")
    assert get_res.status_code == 200
    assert len(get_res.json()) >= 1

    # 5. Create another user and verify they can't see the board
    other_username = f"otheruser_{int(time.time())}"
    requests.post(f"{API_URL}/auth/register", json={"username": other_username, "password": password})
    other_login = requests.post(f"{API_URL}/auth/login", json={"username": other_username, "password": password})
    other_cookies = other_login.cookies
    
    other_get_res = requests.get(f"{API_URL}/boards", cookies=other_cookies)
    print(f"Other User Get Boards: {other_get_res.status_code} - {len(other_get_res.json())} boards found")
    assert other_get_res.status_code == 200
    # Should be 0 boards for the new user
    assert len(other_get_res.json()) == 0

    print("--- Backend Auth & Board Filtering Tests Passed! ---")

if __name__ == "__main__":
    try:
        test_auth_and_boards()
    except Exception as e:
        print(f"Tests failed: {e}")
