"""Tint Window Materials & Quotation Router."""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field

from backend.domains.tint.window_materials import (
    DEFAULT_TINT_WINDOW_MATERIALS_POLICY,
    GLASS_ZONES,
    ZONE_TO_GROUP,
    SIZE_BANDS,
    resolve_vehicle_glass_bands,
    get_available_materials_for_zone,
    validate_tint_window_plan,
    quote_tint_window_plan,
    merge_policy_for_role,
)


class WindowPlanPayload(BaseModel):
    vehicle_id: Optional[str] = None
    windows: Dict[str, Any] = Field(..., description="Plan per window zone")
    notes: Optional[str] = None


class GlassMeasurementsPayload(BaseModel):
    windshield_height_in: Optional[float] = None
    side_height_in: Optional[float] = None
    rear_height_in: Optional[float] = None


def get_tint_materials_router(
    db: Any,
    require_auth: Any,
    require_roles: Any,
) -> APIRouter:
    router = APIRouter(prefix="/tint", tags=["Tint Materials & Window Planner"])

    async def _load_tint_policy() -> Dict[str, Any]:
        doc = await db.settings.find_one({"type": "tint_window_materials"}, {"_id": 0})
        if not doc or not isinstance(doc, dict):
            return dict(DEFAULT_TINT_WINDOW_MATERIALS_POLICY)
        # Asegurar defaults si faltan campos
        merged = dict(DEFAULT_TINT_WINDOW_MATERIALS_POLICY)
        merged.update(doc.get("policy") or doc)
        return merged

    @router.get("/window-config")
    async def get_window_config(
        request: Request,
        vehicle_id: Optional[str] = Query(None),
        allow_override: bool = Query(True),
    ):
        """Devuelve la configuración de zonas, tallas de cristal y materiales para un vehículo."""
        await require_auth(request)
        policy = await _load_tint_policy()

        vehicle_doc = None
        if vehicle_id:
            vehicle_doc = await db.vehicles.find_one(
                {"$or": [{"vehicle_id": vehicle_id}, {"id": vehicle_id}]},
                {"_id": 0},
            )

        bands = resolve_vehicle_glass_bands(vehicle_doc, policy)

        zones_config = {}
        for zone in GLASS_ZONES:
            band = bands.get(zone, "side_under_20")
            available_mats = get_available_materials_for_zone(
                zone=zone,
                size_band=band,
                policy=policy,
                allow_override=allow_override,
            )
            zones_config[zone] = {
                "zone": zone,
                "group": ZONE_TO_GROUP.get(zone, "sides"),
                "size_band": band,
                "size_band_info": SIZE_BANDS.get(band, {}),
                "materials": available_mats,
            }

        return {
            "vehicle_id": vehicle_id,
            "vehicle_name": f"{vehicle_doc.get('brand', '')} {vehicle_doc.get('model', '')}".strip() if vehicle_doc else "Vehículo Estándar",
            "vehicle_size_bands": bands,
            "zones": zones_config,
            "policy": {
                "require_plan_on_installed_sale": policy.get("require_plan_on_installed_sale", False),
                "max_materials_per_vehicle": policy.get("max_materials_per_vehicle", 3),
            },
        }

    @router.post("/window-plan/validate")
    async def validate_plan_endpoint(
        payload: WindowPlanPayload,
        request: Request,
    ):
        """Valida un plan de polarizado sin generar cobro."""
        await require_auth(request)
        policy = await _load_tint_policy()
        vehicle_doc = None
        if payload.vehicle_id:
            vehicle_doc = await db.vehicles.find_one(
                {"$or": [{"vehicle_id": payload.vehicle_id}, {"id": payload.vehicle_id}]},
                {"_id": 0},
            )

        plan_dict = payload.dict()
        is_valid, err_msg = validate_tint_window_plan(plan_dict, vehicle_doc, policy)
        return {"valid": is_valid, "error": err_msg}

    @router.post("/window-plan/quote")
    async def quote_plan_endpoint(
        payload: WindowPlanPayload,
        request: Request,
    ):
        """Valida el plan y devuelve el desglose de precios (materials_extra) y consumo de rollos."""
        await require_auth(request)
        policy = await _load_tint_policy()
        vehicle_doc = None
        if payload.vehicle_id:
            vehicle_doc = await db.vehicles.find_one(
                {"$or": [{"vehicle_id": payload.vehicle_id}, {"id": payload.vehicle_id}]},
                {"_id": 0},
            )

        plan_dict = payload.dict()
        quote = quote_tint_window_plan(plan_dict, vehicle_doc, policy)
        if not quote.get("valid"):
            raise HTTPException(status_code=400, detail=quote.get("error") or "Plan de polarizado inválido")
        return quote

    @router.get("/window-materials/policy")
    async def get_tint_materials_policy(request: Request):
        """Obtiene la política completa de materiales de polarizado y rollos."""
        await require_roles(request, ["gerencia", "programador", "coordinador_polarizados", "supervisor"])
        policy = await _load_tint_policy()
        return {"policy": policy}

    @router.put("/window-materials/policy")
    async def update_tint_materials_policy(
        payload: Dict[str, Any],
        request: Request,
    ):
        """Actualiza la política de materiales respetando permisos según rol."""
        actor = await require_roles(request, ["gerencia", "programador", "coordinador_polarizados"])
        current_policy = await _load_tint_policy()
        incoming = payload.get("policy") or payload
        merged = merge_policy_for_role(current_policy, incoming, role=actor.role)

        await db.settings.update_one(
            {"type": "tint_window_materials"},
            {"$set": {"type": "tint_window_materials", "policy": merged, "updated_by": actor.user_id}},
            upsert=True,
        )
        return {"status": "success", "policy": merged}

    @router.put("/vehicles/{vehicle_id}/glass-measurements")
    async def update_vehicle_glass_measurements(
        vehicle_id: str,
        payload: GlassMeasurementsPayload,
        request: Request,
    ):
        """Guarda las medidas reales de cristal para un vehículo."""
        actor = await require_roles(request, ["gerencia", "programador", "supervisor", "coordinador_polarizados"])
        glass_data = {k: v for k, v in payload.dict().items() if v is not None}
        res = await db.vehicles.update_one(
            {"$or": [{"vehicle_id": vehicle_id}, {"id": vehicle_id}]},
            {"$set": {"glass": glass_data, "glass_updated_by": actor.user_id}},
        )
        if res.matched_count == 0:
            raise HTTPException(status_code=404, detail="Vehículo no encontrado")
        return {"status": "success", "glass": glass_data}

    @router.get("/research/glass-sizes")
    async def get_glass_sizes_report(request: Request):
        """Reporte de clasificación de tallas de cristal en el catálogo de vehículos."""
        await require_roles(request, ["gerencia", "programador", "coordinador_polarizados", "supervisor"])
        policy = await _load_tint_policy()
        vehicles = await db.vehicles.find({}, {"_id": 0, "vehicle_id": 1, "brand": 1, "model": 1, "type": 1, "glass": 1}).to_list(500)

        report = []
        for v in vehicles:
            bands = resolve_vehicle_glass_bands(v, policy)
            report.append({
                "vehicle_id": v.get("vehicle_id"),
                "brand": v.get("brand"),
                "model": v.get("model"),
                "type": v.get("type"),
                "has_real_measurements": bool(v.get("glass")),
                "size_bands": bands,
            })
        return {"total_vehicles": len(report), "report": report}

    return router
