#!/usr/bin/env python3
import requests
import os

BASE = os.environ.get('BASE_URL', 'http://localhost:8001')
S = requests.Session()

print('GET /api/auth/pin/users')
r = S.get(f"{BASE}/api/auth/pin/users")
print('status', r.status_code)
users = r.json()
print('total pin users:', len(users))
# Prefer Xinon
user_id = None
for u in users:
    if u.get('name') == 'Xinon':
        user_id = u.get('user_id')
        break

# Try login: prefer Xinon with known PIN 01011990, else try pin '111111'
for pin_try in ['01011990', '111111', '222222', '333333']:
    print('trying pin', pin_try)
    resp = S.post(f"{BASE}/api/auth/pin/login", json={'pin': pin_try})
    print('login status', resp.status_code)
    if resp.status_code == 200:
        print('login ok')
        break
else:
    print('login failed for tested pins')
    raise SystemExit(1)

# Fetch customers
r = S.get(f"{BASE}/api/customers")
print('/api/customers status', r.status_code)
try:
    data = r.json()
    print('customers returned:', len(data) if isinstance(data, list) else 'not list')
    print('sample:', data[:5])
except Exception as e:
    print('failed to parse json:', e)
    print('text:', r.text)
