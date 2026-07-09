import httpx

BASE = "http://127.0.0.1:8001/api"


def main() -> None:
    client = httpx.Client(timeout=60.0)
    client.post(f"{BASE}/auth/pin/login", json={"pin": "01011990"})
    response = client.post(
        f"{BASE}/inventory",
        json={
            "product_id": "prod_alf_001",
            "warehouse_id": "wh_main",
            "quantity": 50,
            "min_stock": 2,
        },
    )
    print("post", response.status_code, response.text[:500])
    inventory = client.get(f"{BASE}/inventory", params={"warehouse_id": "wh_main"})
    rows = [row for row in inventory.json() if row.get("product_id") == "prod_alf_001"]
    print("found", rows)


if __name__ == "__main__":
    main()