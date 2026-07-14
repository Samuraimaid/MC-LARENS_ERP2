"""Resolve active driver vehicles for server dashboard fleet telemetry."""
from __future__ import annotations

import re
from typing import Any

from backend.domains.vehicles.descriptor_classifier import classify_descriptor
from backend.domains.vehicles.type_resolver import (
    CANONICAL_TYPE_LABELS,
    resolve_vehicle_record_slug,
)


def _norm_plate(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", str(value or "").lower())


def _pick_active_driver(drivers: list[dict[str, Any]]) -> dict[str, Any] | None:
    if not drivers:
        return None
    en_ruta = [
        driver
        for driver in drivers
        if str(driver.get("status") or "").strip().lower() == "en_ruta"
    ]
    if en_ruta:
        with_vehicle = [d for d in en_ruta if d.get("vehicle_id") or d.get("vehicle_plate")]
        return (with_vehicle or en_ruta)[0]
    delivery = [
        driver
        for driver in drivers
        if str(driver.get("driver_type") or "").strip().lower() == "delivery_last_mile"
    ]
    if delivery:
        return delivery[0]
    return drivers[0]


async def _lookup_vehicle_for_driver(db, driver: dict[str, Any]) -> dict[str, Any] | None:
    vehicle_id = str(driver.get("vehicle_id") or "").strip()
    if vehicle_id:
        doc = await db.vehicles.find_one({"vehicle_id": vehicle_id}, {"_id": 0})
        if doc:
            return doc

    plate = str(driver.get("vehicle_plate") or driver.get("plate") or "").strip()
    if not plate:
        return None

    normalized = _norm_plate(plate)
    cursor = db.vehicles.find(
        {
            "$or": [
                {"plate": plate},
                {"plate_number": plate},
            ]
        },
        {"_id": 0},
    ).limit(20)
    async for row in cursor:
        row_plate = str(row.get("plate") or row.get("plate_number") or "")
        if _norm_plate(row_plate) == normalized:
            return row
    return None


def _resolve_vehicle_slug(vehicle: dict[str, Any]) -> dict[str, str]:
    preset = str(vehicle.get("vehicle_type_slug") or vehicle.get("thumbnail_slug") or "").strip().lower()
    if preset:
        label = str(vehicle.get("vehicle_type") or vehicle.get("vehicle_type_label") or "").strip()
        if not label:
            label = CANONICAL_TYPE_LABELS.get(preset, preset.replace("-", " ").title())
        return {
            "vehicle_type_slug": preset,
            "thumbnail_slug": str(vehicle.get("thumbnail_slug") or preset),
            "vehicle_type_label": label,
            "classification_source": str(vehicle.get("classification_source") or "catalog"),
        }

    brand = str(vehicle.get("brand") or "").strip()
    descriptor = str(vehicle.get("descriptor") or "").strip()
    model = str(vehicle.get("model") or "").strip()
    if brand and descriptor:
        classified = classify_descriptor(brand, descriptor, model=model, refresh_stale_overrides=True)
        slug = str(classified.get("vehicle_type_slug") or "sedan")
        return {
            "vehicle_type_slug": slug,
            "thumbnail_slug": slug,
            "vehicle_type_label": str(classified.get("vehicle_type_label") or slug),
            "classification_source": str(classified.get("classification_source") or "rules"),
        }

    slug = resolve_vehicle_record_slug(vehicle, allow_default=True) or "default"
    return {
        "vehicle_type_slug": slug,
        "thumbnail_slug": slug,
        "vehicle_type_label": CANONICAL_TYPE_LABELS.get(slug, slug.replace("-", " ").title()),
        "classification_source": str(vehicle.get("classification_source") or "rules"),
    }


def _format_fleet_display(brand: str, model: str, plate: str) -> str:
    identity = " ".join(part for part in [brand.strip(), model.strip()] if part).strip() or "Vehículo ERP"
    plate_text = plate.strip() or "—"
    return f"{identity} - Placa: {plate_text}"


async def resolve_branch_fleet_vehicle(
    db,
    *,
    branch_id: str,
    drivers: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Resolve the active street fleet vehicle for dashboard telemetry."""
    branch_drivers = [d for d in (drivers or []) if str(d.get("branch_id") or "") == str(branch_id)]
    driver = _pick_active_driver(branch_drivers)
    if not driver:
        return {
            "resolved": False,
            "driver_id": None,
            "brand": None,
            "model": None,
            "plate_number": None,
            "vehicle_type_slug": None,
            "thumbnail_slug": None,
            "vehicle_type_label": None,
            "classification_source": None,
            "fleet_display": None,
        }

    vehicle = await _lookup_vehicle_for_driver(db, driver)
    plate = str(
        (vehicle or {}).get("plate")
        or (vehicle or {}).get("plate_number")
        or driver.get("vehicle_plate")
        or ""
    ).strip()
    brand = str((vehicle or {}).get("brand") or "").strip()
    model = str((vehicle or {}).get("model") or "").strip()

    if vehicle:
        slug_info = _resolve_vehicle_slug(vehicle)
    else:
        slug_info = {
            "vehicle_type_slug": None,
            "thumbnail_slug": None,
            "vehicle_type_label": None,
            "classification_source": "driver_plate_only",
        }

    fleet_display = _format_fleet_display(brand, model, plate) if (brand or model or plate) else None

    return {
        "resolved": bool(vehicle or plate),
        "driver_id": driver.get("driver_id"),
        "driver_name": " ".join(
            part for part in [driver.get("name"), driver.get("last_name")] if part
        ).strip()
        or None,
        "driver_status": driver.get("status"),
        "vehicle_id": (vehicle or {}).get("vehicle_id") or driver.get("vehicle_id"),
        "brand": brand or None,
        "model": model or None,
        "plate_number": plate or None,
        "fleet_display": fleet_display,
        **slug_info,
    }