import requests

BASE = "http://localhost:8001/api"
s = requests.Session()
login = s.post(f"{BASE}/auth/pin/login", json={"pin": "01011990"})
print("login", login.status_code)

products = s.get(f"{BASE}/products").json()
warehouses = s.get(f"{BASE}/warehouses").json()
pid = products[0]["product_id"] if products else None
wid = warehouses[0]["warehouse_id"] if warehouses else None
print("product", pid, "warehouse", wid)

payload = {
    "product_id": pid,
    "warehouse_id": wid,
    "quantity": 20,
    "template_id": "rect_50x30",
}
preview = s.post(f"{BASE}/inventory/labels/preview", json=payload)
print("preview", preview.status_code, preview.headers.get("content-type"), len(preview.content))

tspl = s.post(f"{BASE}/inventory/labels/print", json={**payload, "output_format": "tspl"})
print("tspl", tspl.status_code, tspl.text[:200])

pdf = s.post(f"{BASE}/inventory/labels/print", json={**payload, "output_format": "pdf"})
print("pdf", pdf.status_code, len(pdf.content))

catalog = s.get(f"{BASE}/permissions/catalog").json()
funcs = (catalog.get("inventario") or {}).get("functions") or {}
print("inventory_labels in catalog", "inventory_labels" in funcs, funcs.get("inventory_labels"))