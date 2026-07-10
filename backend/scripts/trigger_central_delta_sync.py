#!/usr/bin/env python3
"""Replica inventario local hacia MongoDB Atlas tras restauracion Delta (fire-and-forget)."""
from __future__ import annotations

import asyncio
import os
import sys
from datetime import datetime, timezone

try:
    from motor.motor_asyncio import AsyncIOMotorClient
except ImportError:
    print("[sync] motor no disponible en el contenedor", file=sys.stderr)
    raise SystemExit(2)


async def main() -> int:
    central_uri = (os.getenv("MONGODB_CENTRAL_URI") or "").strip()
    if not central_uri:
        print("[sync] MONGODB_CENTRAL_URI no configurado; sincronizacion Atlas omitida.")
        return 0

    local_uri = os.getenv("MONGODB_LOCAL_URI", "mongodb://mongodb:27017")
    db_name = os.getenv("DB_NAME", "mc-larens2_mundo_accesorios_erp")
    central_db_name = os.getenv("MONGODB_CENTRAL_DB", db_name)
    branch_id = (os.getenv("BRANCH_ID") or os.getenv("NODE_ID") or "branch_main").strip()

    local_client = AsyncIOMotorClient(local_uri, serverSelectionTimeoutMS=8000)
    central_client = AsyncIOMotorClient(central_uri, serverSelectionTimeoutMS=12000)

    await central_client.admin.command("ping")
    print("[sync] Atlas alcanzable; iniciando replicacion delta de inventario...")

    local_db = local_client[db_name]
    central_db = central_client[central_db_name]
    synced_at = datetime.now(timezone.utc).isoformat()
    count = 0

    async for row in local_db.inventory.find({}, {"_id": 0}):
        product_id = str(row.get("product_id") or "").strip()
        warehouse_id = str(row.get("warehouse_id") or "").strip()
        if not product_id or not warehouse_id:
            continue
        doc = {
            **row,
            "branch_id": str(row.get("branch_id") or branch_id),
            "synced_at": synced_at,
            "source_event": "post_restore_delta_sync",
        }
        await central_db.inventory.update_one(
            {
                "product_id": product_id,
                "warehouse_id": warehouse_id,
                "branch_id": doc["branch_id"],
            },
            {"$set": doc},
            upsert=True,
        )
        count += 1

    print(f"[sync] {count} filas de inventario replicadas a Atlas de forma asincrona.")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))