#!/usr/bin/env python3
from __future__ import annotations

import asyncio
import json

from backend.server import _sale_items_preview_for_cashier, db


async def main() -> None:
    sales = await db.sales.find({}, {"_id": 0}).sort("created_at", -1).limit(8).to_list(8)
    print(f"sales={len(sales)}")
    for sale in sales:
        print("===", sale.get("invoice_number"), "===")
        print(
            "currency=", sale.get("currency"),
            "rate=", sale.get("exchange_rate"),
            "subtotal=", sale.get("subtotal"),
            "pending=", sale.get("amount_pending"),
        )
        for item in sale.get("items") or []:
            print(
                "  raw",
                item.get("product_name"),
                "unit=", item.get("unit_price"),
                "orig=", item.get("original_unit_price"),
                "item_sub=", item.get("subtotal"),
                "disc=", item.get("discount"),
                "install=", item.get("installation_price"),
            )
        preview = _sale_items_preview_for_cashier(sale)
        print("  items_detail=", json.dumps(preview.get("items_detail"), ensure_ascii=False))
        print()


if __name__ == "__main__":
    asyncio.run(main())