import time
import requests

time.sleep(2)
base = "http://localhost:8001/api"
s = requests.Session()
login = s.post(f"{base}/auth/pin/login", json={"pin": "01011990"}, timeout=15)
print("login", login.status_code)

create = s.post(
    f"{base}/inventory/transfer-request",
    json={
        "product_id": "prod_def_001",
        "from_warehouse_id": "wh_main",
        "to_warehouse_id": "wh_topcar_calvario",
        "quantity": 1,
        "reason": "two-step test",
    },
    timeout=15,
)
print("create", create.status_code, create.text[:200])
req_id = create.json().get("request_id") if create.ok else None

if req_id:
    for step, path in [
        ("approve", f"/inventory/transfer-requests/{req_id}/approve"),
        ("ship", f"/inventory/transfer-requests/{req_id}/ship"),
        ("receive", f"/inventory/transfer-requests/{req_id}/receive"),
    ]:
        resp = s.put(f"{base}{path}", timeout=15)
        print(step, resp.status_code, resp.text[:200])