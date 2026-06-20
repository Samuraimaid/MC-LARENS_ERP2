#!/usr/bin/env python3
import json
import requests

API = "http://127.0.0.1:8001/api"

def login(pin):
    s = requests.Session()
    r = s.post(f"{API}/auth/pin/login", json={"pin": pin}, timeout=30)
    r.raise_for_status()
    return s, r.json()["user"]

s, user = login("01011990")
print("gerencia", user["user_id"], user.get("branch_id"))

customers = s.get(f"{API}/customers", timeout=30).json()
print("customers", len(customers))

products = s.get(f"{API}/products", timeout=30).json()
inventory = s.get(f"{API}/inventory", timeout=30).json()
inv_map = {}
for row in inventory:
    key = (row.get("product_id"), row.get("warehouse_id"))
    inv_map[key] = float(row.get("quantity") or 0)

physical = []
install = []
for p in products:
    if p.get("product_type") == "service":
        continue
    stock = sum(v for (pid, _), v in inv_map.items() if pid == p.get("product_id"))
    it = p.get("installation_type") or "optional"
    row = {
        "id": p.get("product_id"),
        "name": p.get("name"),
        "price": p.get("price"),
        "stock": stock,
        "install": it,
        "dept": p.get("installation_department"),
    }
    if stock >= 20:
        physical.append(row)
    if it in ("required", "optional") and stock >= 10:
        install.append(row)

print("physical_stock>=20", len(physical))
for row in physical[:8]:
    print(" ", row)
print("install_candidates", len(install))
for row in install[:8]:
    print(" ", row)

vehicles = s.get(f"{API}/vehicles", timeout=30).json()
print("vehicles", len(vehicles))

users = s.get(f"{API}/auth/pin/users", timeout=30).json()
roles = {}
for u in users:
    roles.setdefault(u.get("role"), []).append(u)
print("roles", {k: len(v) for k, v in sorted(roles.items())})
for role in ["coordinador_instalaciones", "coordinador_polarizados", "bodegas", "instalaciones"]:
    print(role, roles.get(role, []))

dispatch = s.get(f"{API}/dispatch", timeout=30)
print("dispatch status", dispatch.status_code, len(dispatch.json()) if dispatch.ok else dispatch.text[:120])
wo = s.get(f"{API}/work-orders", timeout=30)
print("work-orders status", wo.status_code, len(wo.json()) if wo.ok else wo.text[:120])