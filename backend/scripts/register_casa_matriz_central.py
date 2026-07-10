#!/usr/bin/env python3
"""Registra Casa Matriz en MongoDB Atlas (erp_server_nodes + branches)."""
from __future__ import annotations

import asyncio
import os
import sys
from datetime import datetime, timezone

try:
    from motor.motor_asyncio import AsyncIOMotorClient
except ImportError:
    print("[register] motor no disponible", file=sys.stderr)
    raise SystemExit(2)

from backend.domains.deployment.node_profile import build_node_profile


async def main() -> int:
    central_uri = (os.getenv("MONGODB_CENTRAL_URI") or "").strip()
    if not central_uri:
        print("[register] MONGODB_CENTRAL_URI no configurado; registro central omitido.")
        return 0

    db_name = os.getenv("MONGODB_CENTRAL_DB") or os.getenv("DB_NAME", "mc-larens2_mundo_accesorios_erp")
    profile = build_node_profile()
    node_type = str(profile.get("node_type") or "").upper()
    node_id = str(profile.get("node_id") or "branch_main").strip()

    if node_type != "CASA_MATRIZ" or node_id != "branch_main":
        print(f"[register] Nodo {node_id} ({node_type}) no es Casa Matriz; registro omitido.")
        return 0

    now = datetime.now(timezone.utc).isoformat()
    lan_ip = str(profile.get("lan_ip") or os.getenv("SERVER_LAN_IP") or "").strip()
    port = int(profile.get("frontend_port") or os.getenv("SERVER_FRONTEND_PORT") or 3000)
    node_name = str(profile.get("node_name") or "Casa Matriz - Mundo de Accesorios").strip()
    public_url = (os.getenv("PUBLIC_TUNNEL_URL_MAIN") or "https://mclarenerp.com").rstrip("/")

    client = AsyncIOMotorClient(central_uri, serverSelectionTimeoutMS=15000)
    await client.admin.command("ping")
    db = client[db_name]

    node_doc = {
        "node_id": node_id,
        "branch_id": node_id,
        "node_type": "CASA_MATRIZ",
        "node_name": node_name,
        "lan_ip": lan_ip,
        "frontend_port": port,
        "access_url": f"http://{lan_ip}:{port}" if lan_ip else "",
        "public_url": public_url,
        "status": "active",
        "registered_at": now,
        "updated_at": now,
        "source": "toolbox_op0",
    }
    await db.erp_server_nodes.update_one(
        {"node_id": node_id},
        {"$set": node_doc, "$setOnInsert": {"created_at": now}},
        upsert=True,
    )

    branch_doc = {
        "branch_id": node_id,
        "name": node_name,
        "lan_ip": lan_ip,
        "node_type": "CASA_MATRIZ",
        "is_main": True,
        "updated_at": now,
    }
    await db.branches.update_one(
        {"branch_id": node_id},
        {"$set": branch_doc, "$setOnInsert": {"created_at": now}},
        upsert=True,
    )

    print(f"[register] Casa Matriz registrada en Atlas: {node_id} @ {lan_ip or public_url}")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))