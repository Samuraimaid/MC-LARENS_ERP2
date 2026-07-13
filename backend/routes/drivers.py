"""ERP driver portal API — deep links, jobs, WhatsApp dispatch helpers."""
from __future__ import annotations

import os
from typing import Any, Dict, Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request

from backend.domains.hr.drivers import (
    assign_driver_user,
    consume_driver_auth_token,
    create_driver_auth_token,
    ensure_erp_drivers,
    get_driver,
    get_driver_by_user_id,
    list_driver_jobs,
    list_drivers,
    load_job_detail,
    normalize_driver_type,
    resolve_driver_auth_token,
    set_driver_status,
    update_delivery_job_status,
    update_transfer_job_status,
)


def get_drivers_router(db, require_auth, require_roles):
    router = APIRouter(prefix="/hr/drivers", tags=["erp-drivers"])

    STAFF_ROLES = ["gerencia", "supervisor", "cajero", "ventas", "bodegas", "jefe_tienda", "programador"]
    DRIVER_ROLES = ["transporte", "entregador", "gerencia", "supervisor"]

    def _public_tunnel_base() -> str:
        return (
            os.environ.get("PUBLIC_TUNNEL_URL_MAIN")
            or os.environ.get("PUBLIC_TUNNEL_URL")
            or "https://mclarenerp.com"
        ).rstrip("/")

    @router.get("")
    async def list_erp_drivers(
        request: Request,
        branch_id: Optional[str] = None,
        driver_type: Optional[str] = None,
    ):
        await require_roles(request, STAFF_ROLES + DRIVER_ROLES)
        return {"drivers": await list_drivers(db, branch_id=branch_id, driver_type=driver_type)}

    @router.get("/auth-token/{job_id}")
    async def generate_driver_auth_token(job_id: str, request: Request):
        """Genera token de un solo uso (30 min) para deep link de conductor."""
        actor = await require_roles(request, STAFF_ROLES)
        job = await load_job_detail(db, job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Trabajo no encontrado")
        payload = await create_driver_auth_token(
            db,
            job_id,
            created_by=getattr(actor, "user_id", None),
            ttl_minutes=30,
        )
        base = _public_tunnel_base()
        payload["deep_link_url"] = f"{base}{payload['deep_link_path']}"
        payload["job"] = job
        return payload

    @router.get("/deep-link/{token}")
    async def resolve_deep_link(token: str):
        row = await resolve_driver_auth_token(db, token)
        if not row:
            raise HTTPException(status_code=404, detail="Token inválido o expirado")
        job = await load_job_detail(db, row["job_id"])
        return {
            "valid": True,
            "token": token,
            "job_id": row["job_id"],
            "job_type": row["job_type"],
            "expires_at": row.get("expires_at"),
            "job": job,
        }

    @router.post("/portal/consume-token")
    async def consume_token_and_bind(request: Request, payload: Dict[str, Any]):
        user = await require_roles(request, DRIVER_ROLES)
        token = str((payload or {}).get("token") or "").strip()
        if not token:
            raise HTTPException(status_code=400, detail="token requerido")
        row = await consume_driver_auth_token(db, token, user.user_id)
        if not row:
            raise HTTPException(status_code=404, detail="Token inválido o expirado")
        driver = await get_driver_by_user_id(db, user.user_id)
        if not driver:
            await ensure_erp_drivers(db)
            driver = await get_driver_by_user_id(db, user.user_id)
        job = await load_job_detail(db, row["job_id"])
        return {"job": job, "driver": driver, "consumed": True}

    @router.get("/portal/jobs")
    async def get_portal_jobs(request: Request, include_completed: bool = True):
        user = await require_roles(request, DRIVER_ROLES)
        driver = await get_driver_by_user_id(db, user.user_id)
        if not driver:
            await ensure_erp_drivers(db)
            candidates = await list_drivers(db, branch_id=user.branch_id)
            fallback = next(
                (d for d in candidates if normalize_driver_type(d.get("driver_type")) == "delivery_last_mile"),
                candidates[0] if candidates else None,
            )
            if fallback and not fallback.get("user_id"):
                driver = await assign_driver_user(db, fallback["driver_id"], user.user_id)
            else:
                driver = fallback
        if not driver:
            raise HTTPException(status_code=404, detail="Conductor no vinculado. Contacte a RRHH.")
        return await list_driver_jobs(db, driver, include_completed=include_completed)

    @router.put("/portal/jobs/{job_id}/status")
    async def update_portal_job_status(
        job_id: str,
        payload: Dict[str, Any],
        request: Request,
        background_tasks: BackgroundTasks,
    ):
        user = await require_roles(request, DRIVER_ROLES)
        driver = await get_driver_by_user_id(db, user.user_id)
        if not driver:
            raise HTTPException(status_code=403, detail="Usuario no vinculado a erp_drivers")
        data = payload or {}
        job_type = str(data.get("job_type") or "")
        action = str(data.get("action") or data.get("status") or "").strip().lower()
        notes = data.get("notes")

        if job_type == "transfer_request" or job_id.startswith("transfer:"):
            entity_id = job_id.split(":", 1)[-1] if ":" in job_id else job_id

            def _sync(**kwargs):
                try:
                    from backend.scripts.trigger_central_delta_sync import asyncio as _asyncio
                except Exception:
                    pass

            updated = await update_transfer_job_status(
                db,
                entity_id,
                action,
                driver_id=driver["driver_id"],
            )
            if not updated:
                raise HTTPException(status_code=400, detail="Acción de traslado no válida para el estado actual")
            background_tasks.add_task(_trigger_atlas_inventory_touch, db, updated)
            return {"job": updated, "driver_id": driver["driver_id"]}

        entity_id = job_id.split(":", 1)[-1] if ":" in job_id else job_id
        updated = await update_delivery_job_status(
            db,
            entity_id,
            action or "entregado",
            notes=notes,
            driver_id=driver["driver_id"],
        )
        if not updated:
            raise HTTPException(status_code=404, detail="Entrega no encontrada")
        return {"job": updated, "driver_id": driver["driver_id"]}

    @router.get("/whatsapp-dispatch/{job_id}")
    async def build_whatsapp_dispatch(job_id: str, request: Request, driver_id: Optional[str] = None):
        actor = await require_roles(request, STAFF_ROLES)
        job = await load_job_detail(db, job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Trabajo no encontrado")
        token_payload = await create_driver_auth_token(
            db,
            job_id,
            created_by=getattr(actor, "user_id", None),
        )
        driver = None
        if driver_id:
            driver = await get_driver(db, driver_id)
        if not driver:
            dtype = "inter_branch_haul" if job.get("job_type") == "transfer_request" else "delivery_last_mile"
            matches = await list_drivers(db, branch_id=job.get("branch_id"), driver_type=dtype)
            driver = matches[0] if matches else None
        phone = (driver or {}).get("phone") or ""
        base = _public_tunnel_base()
        deep_url = f"{base}{token_payload['deep_link_path']}"
        if job.get("job_type") == "transfer_request":
            msg = (
                f"MC-LARENS ERP — Traslado asignado\n"
                f"ID: {job.get('entity_id')}\n"
                f"Origen: {job.get('from_warehouse_id')} → Destino: {job.get('to_warehouse_id')}\n"
                f"Producto: {job.get('product_id')} x{job.get('quantity')}\n"
                f"Abrir tarea: {deep_url}"
            )
        else:
            msg = (
                f"MC-LARENS ERP — Entrega asignada\n"
                f"Pedido: {job.get('title')}\n"
                f"Destino: {job.get('destination_label')}\n"
                f"Cliente: {job.get('customer_name')}\n"
                f"Abrir tarea: {deep_url}"
            )
        digits = "".join(ch for ch in phone if ch.isdigit())
        wa_url = f"https://wa.me/{digits}?text={_url_encode(msg)}" if digits else None
        return {
            "message": msg,
            "whatsapp_url": wa_url,
            "deep_link_url": deep_url,
            "token": token_payload["token"],
            "driver": driver,
            "job": job,
        }

    return router


def _url_encode(text: str) -> str:
    from urllib.parse import quote

    return quote(text, safe="")


async def _trigger_atlas_inventory_touch(db, job: Dict[str, Any]) -> None:
    try:
        import asyncio
        from backend.scripts import trigger_central_delta_sync

        await asyncio.sleep(0)
    except Exception:
        return