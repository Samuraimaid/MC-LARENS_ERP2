import requests
import uuid
import time

BASE_URL = "http://localhost:8002"

s = requests.Session()
s.headers.update({"Content-Type": "application/json"})

print("Creating admin test session...")
resp = s.post(f"{BASE_URL}/api/test/create-session")
print(resp.status_code)
if resp.status_code != 200:
    print(resp.text)
    raise SystemExit(1)

data = resp.json()
session_token = data.get("session_token")
print("Admin session token:", session_token)

# Use session for admin actions
s.cookies.set("session_token", session_token)

# Create PIN user with 8-digit PIN
pin = "12345678"
unique_name = f"E2E_PinUser_{uuid.uuid4().hex[:6]}"
payload = {"name": unique_name, "role": "ventas", "pin": pin}
print("Creating PIN user:", unique_name, pin)
create = s.post(f"{BASE_URL}/api/users/pin", json=payload)
print("Create status:", create.status_code)
print(create.text)
if create.status_code != 200:
    raise SystemExit(2)
user = create.json()
user_id = user.get("user_id")
print("Created user_id:", user_id)

# Attempt correct login
print("Attempting correct login...")
s_login = requests.Session()
login = s_login.post(f"{BASE_URL}/api/auth/pin/login", json={"user_id": user_id, "pin": pin})
print("Login status:", login.status_code)
try:
    print(login.json())
except Exception:
    print(login.text)

# If login succeeded, call GET /api/settings/theme
if login.status_code == 200:
    # session cookie should be set on s_login
    print("Fetching theme settings with logged-in session...")
    theme = s_login.get(f"{BASE_URL}/api/settings/theme")
    print("Theme status:", theme.status_code)
    print(theme.json())

# Test lockout behaviour: wrong PIN attempts
print("Testing failed attempts and lockout...")
# create a fresh session for login attempts
s_attempt = requests.Session()
wrong_pin = "00000000"
for i in range(1, 7):
    r = s_attempt.post(f"{BASE_URL}/api/auth/pin/login", json={"user_id": user_id, "pin": wrong_pin})
    print(f"Attempt {i}: status={r.status_code}")
    try:
        print(r.json())
    except Exception:
        print(r.text)
    if r.status_code == 403:
        print("Lockout applied on attempt", i)
        break
    time.sleep(0.5)

# Cleanup: delete created user
print("Cleaning up: deleting created PIN user via admin session...")
delr = s.delete(f"{BASE_URL}/api/users/pin/{user_id}")
print("Delete status:", delr.status_code)
print(delr.text)
