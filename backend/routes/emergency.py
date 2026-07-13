"""Emergency standby routes — host store absorbs fallen branch."""
from __future__ import annotations

import os
from typing import Any, Dict

from fastapi import APIRouter, HTTPException, Request

from backend.db.distributed import ping_central_database, resolve_central_mongo_uri
from backend.middlewares.emergency_standby import resolve_emergency_host_for


def get_emergency_router(db, require_roles):
    router = APIRouter(prefix="/emergency", tags=["emergency-standby"])

    @router.get("/status")
    async def emergency_status():
        host_for = resolve_emergency_host_for()
        atlas = bool(resolve_central_mongo_uri())
        atlas_ok = await ping_central_database() if atlas else None
        return {
            "active": bool(host_for),
            "emergency_host_for": host_for,
            "public_url": os.environ.get("PUBLIC_TUNNEL_URL_MAIN", "https://mclarenerp.com"),
            "atlas_enabled": atlas,
            "atlas_healthy": atlas_ok,
            "message": (
                f"Modo emergencia activo para {host_for} via Atlas"
                if host_for
                else "Modo operación normal"
            ),
        }

    @router.get("/proxy/{branch_id}/profile")
    async def emergency_branch_profile(branch_id: str, request: Request):
        host_for = resolve_emergency_host_for()
        if not host_for or host_for != branch_id:
            raise HTTPException(status_code=404, detail="Modo emergencia no activo para esta sucursal")
        branch = await db.branches.find_one({"branch_id": branch_id}, {"_id": 0})
        nodes = await db.erp_server_nodes.find({"branch_id": branch_id}, {"_id": 0}).to_list(20)
        return {
            "branch_id": branch_id,
            "branch": branch,
            "nodes": nodes,
            "served_by_host": os.environ.get("BRANCH_ID"),
            "source": "atlas_standby",
        }

    @router.post("/activate")
    async def activate_emergency(payload: Dict[str, Any], request: Request):
        await require_roles(request, ["gerencia", "supervisor", "programador"])
        branch_id = str((payload or {}).get("branch_id") or "").strip()
        if not branch_id:
            raise HTTPException(status_code=400, detail="branch_id requerido")
        return {
            "message": "Configure EMERGENCY_HOST_FOR en .env y reinicie el stack",
            "branch_id": branch_id,
            "env_line": f'EMERGENCY_HOST_FOR="{branch_id}"',
        }

    return router