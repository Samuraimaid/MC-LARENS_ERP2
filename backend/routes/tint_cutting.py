"""
MC-LARENS ERP: Rutas de API para la Mesa de Corte de Polarizados
===============================================================
Endpoints para gestión de órdenes de corte, despacho a polarizadores,
ajustes de merma (+0.5m), voucher térmico con croquis y control de rollos activos.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query, Request, Response
from pydantic import BaseModel, Field

from backend.domains.tint.cutting_orders import round_to_cut_multiple
from backend.domains.tint.active_rolls_inventory import (
    get_or_initialize_active_rolls,
    deduct_meters_from_active_roll,
    open_new_roll_from_warehouse,
)
from backend.domains.tint.thermal_cutting_voucher import (
    build_thermal_cutting_voucher_text_lines,
    build_thermal_cutting_voucher_escpos,
    build_thermal_cutting_voucher_html,
)


class AddMetersPayload(BaseModel):
    material_id: str
    roll_width_inches: int = 20
    meters: float = Field(0.50, ge=0.50, description="Múltiplos de 0.50m")
    reason: str = Field(..., min_length=3, description="Motivo del metraje adicional o repetición")


class DispatchCuttingOrderPayload(BaseModel):
    assigned_technician_id: Optional[str] = None
    assigned_technician_name: Optional[str] = None
    notes: Optional[str] = None


class OpenNewRollPayload(BaseModel):
    material_id: str
    roll_width_inches: int = 20
    custom_length_meters: Optional[float] = None


def get_tint_cutting_router(
    db: Any,
    require_auth: Any,
    require_roles: Any,
) -> APIRouter:
    router = APIRouter(prefix="/tint-cutting", tags=["Tint Cutting Station"])

    @router.get("/orders")
    async def get_cutting_orders(
        request: Request,
        status: Optional[str] = None,
        branch_id: Optional[str] = None,
        limit: int = Query(100, ge=1, le=500),
    ):
        """Lista las órdenes de corte filtradas por estado."""
        user = await require_auth(request)
        query: Dict[str, Any] = {}
        if status and status != "all":
            query["status"] = status
        if branch_id:
            query["branch_id"] = branch_id

        orders = await db.tint_cutting_orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
        return orders

    @router.get("/orders/{cut_order_id}")
    async def get_cutting_order_detail(
        cut_order_id: str,
        request: Request,
    ):
        """Retorna los detalles completos de una orden de corte."""
        await require_auth(request)
        order = await db.tint_cutting_orders.find_one({"cut_order_id": cut_order_id}, {"_id": 0})
        if not order:
            raise HTTPException(status_code=404, detail="Orden de corte no encontrada")
        return order

    @router.post("/orders/{cut_order_id}/add-meters")
    async def add_additional_meters_to_cut_order(
        cut_order_id: str,
        payload: AddMetersPayload,
        request: Request,
    ):
        """
        Agrega metraje adicional (+0.5m o múltiplos) a una orden por repetición o merma,
        registrando el motivo y descontando del rollo activo en taller.
        """
        user = await require_roles(request, ["gerencia", "supervisor", "coordinador_polarizados", "programador"])

        order = await db.tint_cutting_orders.find_one({"cut_order_id": cut_order_id})
        if not order:
            raise HTTPException(status_code=404, detail="Orden de corte no encontrada")

        rounded_meters = round_to_cut_multiple(payload.meters)
        branch = order.get("branch_id") or user.get("branch_id") or "principal"
        now_iso = datetime.now(timezone.utc).isoformat()

        # 1. Descontar del rollo en uso en taller
        deduct_res = await deduct_meters_from_active_roll(
            db=db,
            branch_id=branch,
            material_id=payload.material_id,
            roll_width_inches=payload.roll_width_inches,
            meters=rounded_meters,
            cut_order_id=cut_order_id,
            user_info=user,
            note=f"Adición de {rounded_meters:.2f}m por: {payload.reason}",
        )

        # 2. Registrar en la orden de corte
        adjustment_entry = {
            "timestamp": now_iso,
            "meters": rounded_meters,
            "material_id": payload.material_id,
            "roll_width_inches": payload.roll_width_inches,
            "reason": payload.reason,
            "user_id": user.get("user_id"),
            "user_name": user.get("name", "Coordinador"),
        }

        new_additional_total = round(float(order.get("additional_meters_total", 0.0)) + rounded_meters, 2)

        await db.tint_cutting_orders.update_one(
            {"cut_order_id": cut_order_id},
            {
                "$inc": {"total_meters": rounded_meters},
                "$set": {"additional_meters_total": new_additional_total, "updated_at": now_iso},
                "$push": {"adjustments": adjustment_entry},
            },
        )

        # Actualizar también tint_orders
        if order.get("tint_order_id"):
            await db.tint_orders.update_one(
                {"tint_order_id": order["tint_order_id"]},
                {"$inc": {"total_cutting_meters": rounded_meters}},
            )

        return {
            "success": True,
            "cut_order_id": cut_order_id,
            "added_meters": rounded_meters,
            "new_total_meters": round(float(order.get("total_meters", 0.0)) + rounded_meters, 2),
            "roll_status": deduct_res,
            "message": f"Se agregaron +{rounded_meters:.2f}m a la orden. Motivo: {payload.reason}",
        }

    @router.post("/orders/{cut_order_id}/dispatch")
    async def dispatch_cutting_order(
        cut_order_id: str,
        payload: DispatchCuttingOrderPayload,
        request: Request,
    ):
        """
        Marca el material como cortado y despachado, descuenta los metros de los rollos activos
        en taller y actualiza la orden en el KDS para que el polarizador empiece la instalación.
        """
        user = await require_roles(request, ["gerencia", "supervisor", "coordinador_polarizados", "programador"])

        order = await db.tint_cutting_orders.find_one({"cut_order_id": cut_order_id})
        if not order:
            raise HTTPException(status_code=404, detail="Orden de corte no encontrada")

        if order.get("status") == "cut_ready" or order.get("status") == "delivered":
            return {"success": True, "message": "La orden ya fue despachada previamente.", "status": order.get("status")}

        branch = order.get("branch_id") or user.get("branch_id") or "principal"
        now_iso = datetime.now(timezone.utc).isoformat()

        # Descontar cada rollo del resumen
        roll_summary = order.get("roll_summary", [])
        deduction_results = []
        for r in roll_summary:
            mat_id = r.get("material_id")
            w = r.get("roll_width_inches", 20)
            m = float(r.get("total_meters", 0.0))
            if mat_id and m > 0:
                res = await deduct_meters_from_active_roll(
                    db=db,
                    branch_id=branch,
                    material_id=mat_id,
                    roll_width_inches=w,
                    meters=m,
                    cut_order_id=cut_order_id,
                    user_info=user,
                )
                deduction_results.append(res)

        # Actualizar estado de la orden de corte
        tech_id = payload.assigned_technician_id or order.get("assigned_technician_id")
        tech_name = payload.assigned_technician_name or order.get("assigned_technician_name")

        await db.tint_cutting_orders.update_one(
            {"cut_order_id": cut_order_id},
            {
                "$set": {
                    "status": "cut_ready",
                    "assigned_technician_id": tech_id,
                    "assigned_technician_name": tech_name,
                    "cut_by_user_id": user.get("user_id"),
                    "cut_by_user_name": user.get("name", "Coordinador"),
                    "cut_at": now_iso,
                    "delivered_at": now_iso,
                    "notes": payload.notes or order.get("notes"),
                    "updated_at": now_iso,
                }
            },
        )

        # Actualizar la orden de polarizado en KDS
        if order.get("tint_order_id"):
            tint_update = {
                "cutting_status": "cut_ready",
                "material_ready_at": now_iso,
                "status": "ready_to_install",
            }
            if tech_id:
                tint_update["assigned_technician_id"] = tech_id
                tint_update["assigned_technician_name"] = tech_name

            await db.tint_orders.update_one(
                {"tint_order_id": order["tint_order_id"]},
                {"$set": tint_update},
            )

        return {
            "success": True,
            "cut_order_id": cut_order_id,
            "status": "cut_ready",
            "assigned_technician_name": tech_name,
            "deduction_results": deduction_results,
            "message": f"Orden #{cut_order_id} cortada y despachada a {tech_name or 'polarizadores'}.",
        }

    @router.get("/orders/{cut_order_id}/voucher/html")
    async def get_cutting_voucher_html(
        cut_order_id: str,
        request: Request,
    ):
        """Genera la página HTML del voucher con croquis para impresión directa."""
        await require_auth(request)
        order = await db.tint_cutting_orders.find_one({"cut_order_id": cut_order_id}, {"_id": 0})
        if not order:
            raise HTTPException(status_code=404, detail="Orden de corte no encontrada")

        html_content = build_thermal_cutting_voucher_html(order)
        return Response(content=html_content, media_type="text/html")

    @router.get("/orders/{cut_order_id}/voucher/escpos")
    async def get_cutting_voucher_escpos(
        cut_order_id: str,
        request: Request,
    ):
        """Retorna los bytes ESC/POS binarios para enviar a impresora térmica de 80mm."""
        await require_auth(request)
        order = await db.tint_cutting_orders.find_one({"cut_order_id": cut_order_id}, {"_id": 0})
        if not order:
            raise HTTPException(status_code=404, detail="Orden de corte no encontrada")

        escpos_bytes = build_thermal_cutting_voucher_escpos(order)
        return Response(content=escpos_bytes, media_type="application/octet-stream")

    @router.get("/active-rolls")
    async def get_active_rolls_inventory(
        request: Request,
        branch_id: Optional[str] = None,
    ):
        """Consulta el estado en metros de los rollos activos en taller."""
        user = await require_auth(request)
        effective_branch = branch_id or user.get("branch_id") or "principal"
        rolls = await get_or_initialize_active_rolls(db, effective_branch)
        return rolls

    @router.post("/active-rolls/open-new")
    async def open_new_roll(
        payload: OpenNewRollPayload,
        request: Request,
    ):
        """
        Abre un nuevo rollo en taller, restando 1 rollo sellado de bodega
        y recargando 30.00 metros al rollo activo.
        """
        user = await require_roles(request, ["gerencia", "supervisor", "coordinador_polarizados", "programador"])
        branch = user.get("branch_id") or "principal"

        result = await open_new_roll_from_warehouse(
            db=db,
            branch_id=branch,
            material_id=payload.material_id,
            roll_width_inches=payload.roll_width_inches,
            user_info=user,
            custom_length_meters=payload.custom_length_meters,
        )

        return result

    return router
