#!/usr/bin/env python3
import asyncio
import os
from collections import Counter

from motor.motor_asyncio import AsyncIOMotorClient


async def main() -> None:
    uri = os.environ.get("MONGO_URL") or "mongodb://mongodb:27017"
    dbn = os.environ.get("DB_NAME") or "mc-larens2_mundo_accesorios_erp"
    db = AsyncIOMotorClient(uri)[dbn]
    products = await db.products.find(
        {"product_type": {"$ne": "service"}},
        {
            "_id": 0,
            "product_id": 1,
            "name": 1,
            "price": 1,
            "category": 1,
            "installation_price": 1,
            "installation_type": 1,
        },
    ).to_list(2000)
    cats = Counter(str(p.get("category") or "none") for p in products)
    print("CATEGORIES:", dict(sorted(cats.items(), key=lambda x: -x[1])[:30]))
    for cat in [
        "polarizados",
        "accesorios_electronicos",
        "audio",
        "security",
        "defensas",
        "accesorios",
        "iluminacion",
    ]:
        rows = [
            p
            for p in products
            if str(p.get("category") or "").lower() == cat
            and float(p.get("price") or 0) > 0
        ]
        with_inst = [p for p in rows if float(p.get("installation_price") or 0) > 0]
        print(f"{cat}: total={len(rows)} with_install_price={len(with_inst)}")
        if with_inst:
            p = with_inst[0]
            print("  sample", p.get("product_id"), p.get("name"), p.get("price"), p.get("installation_price"))
        elif rows:
            p = rows[0]
            print("  sample no-install", p.get("product_id"), p.get("name"), p.get("price"))

    inv = await db.inventory.find({"quantity": {"$gte": 5}}, {"_id": 0}).to_list(500)
    stock = {r["product_id"]: r for r in inv if r.get("warehouse_id") == "wh_main"}
    print("stocked_wh_main_ge5", len(stock))


if __name__ == "__main__":
    asyncio.run(main())
