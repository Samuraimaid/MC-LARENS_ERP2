import time
import requests

time.sleep(2)
base = "http://localhost:8001/api"
s = requests.Session()
print("login", s.post(f"{base}/auth/pin/login", json={"pin": "01011990"}).status_code)

prods = s.get(f"{base}/products").json()
pid = prods[0]["product_id"]
r = s.post(
    f"{base}/inventory/purchase-receipt",
    json={"warehouse_id": "wh_main", "items": [{"product_id": pid, "quantity": 1}]},
)
print("blind_intake", r.status_code, r.text[:300])
assert "supplier" not in r.text.lower()
assert "cost_usd" not in r.text.lower()

qa = s.post(f"{base}/qa/run-logistic-simulation-suite")
print("logistic_qa", qa.status_code, qa.text[:400])