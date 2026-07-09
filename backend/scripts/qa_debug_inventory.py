import httpx

from backend.domains.qa.full_simulation_suite import (
    PIN_GERENCIA,
    PIN_VENTAS,
    WAREHOUSE_ID,
    _ensure_stock,
    _pick_products,
)

BASE = "http://127.0.0.1:8001/api"


def main() -> None:
    gerencia = httpx.Client(timeout=60.0)
    ventas = httpx.Client(timeout=60.0)
    gerencia.post(f"{BASE}/auth/pin/login", json={"pin": PIN_GERENCIA})
    ventas.post(f"{BASE}/auth/pin/login", json={"pin": PIN_VENTAS})
    products = _pick_products(ventas.get(f"{BASE}/products").json(), 5)
    print("products:", [p["product_id"] for p in products])
    for product in products:
        inv = gerencia.get(
            f"{BASE}/inventory",
            params={"product_id": product["product_id"], "warehouse_id": WAREHOUSE_ID},
        )
        print("before", product["product_id"], inv.status_code, inv.text[:200])
    _ensure_stock(gerencia, products, WAREHOUSE_ID)
    for product in products:
        inv = gerencia.get(
            f"{BASE}/inventory",
            params={"product_id": product["product_id"], "warehouse_id": WAREHOUSE_ID},
        )
        print("after", product["product_id"], inv.status_code, inv.text[:200])


if __name__ == "__main__":
    main()