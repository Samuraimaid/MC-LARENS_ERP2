import json
import requests

BASE = "http://localhost:8001/api"
s = requests.Session()
login = s.post(f"{BASE}/auth/pin/login", json={"pin": "01011990"})
print("login", login.status_code)

setup = s.get(f"{BASE}/system-settings/label-printer/setup")
print("setup", setup.status_code)
print(json.dumps(setup.json(), indent=2, ensure_ascii=False)[:2000])

status = s.get(f"{BASE}/system-settings/label-printer/status")
print("status", status.status_code, status.json())

test = s.post(
    f"{BASE}/system-settings/label-printer/test-print",
    json={"station_name": "PC Bodega Test"},
)
print("test-print", test.status_code)
print(test.text[:500])