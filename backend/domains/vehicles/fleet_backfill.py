"""Backfill vehicle_type_slug on existing fleet records from master catalog."""
from __future__ import annotations

from typing import Any

from backend.domains.vehicles.catalog_sync import load_catalog_entries
from backend.domains.vehicles.descriptor_classifier import classify_descriptor
from backend.domains.vehicles.vehicle_cab import apply_cab_to_vehicle_doc, is_pickup_slug


def _catalog_label_index(entries: list[dict[str, Any]]) -> dict[tuple[str, str], dict[str, Any]]:
    index: dict[tuple[str, str], dict[str, Any]] = {}
    for entry in entries:
        brand = str(entry.get("brand") or "").strip().upper()
        label = str(entry.get("label") or "").strip()
        if brand and label:
            index[(brand, label)] = entry
    return index


async def backfill_fleet_vehicle_slugs(db: Any, *, dry_run: bool = False, limit: int = 5000) -> dict[str, int]:
    entries = load_catalog_entries()
    label_index = _catalog_label_index(entries)

    cursor = db.vehicles.find(
        {
            "$or": [
                {"vehicle_type_slug": {"$exists": False}},
                {"vehicle_type_slug": ""},
                {"vehicle_type_slug": None},
            ]
        },
        {"_id": 0, "vehicle_id": 1, "brand": 1, "model": 1, "descriptor": 1, "vehicle_cab_variant": 1, "body_class": 1},
    ).limit(max(1, min(limit, 20000)))

    scanned = 0
    updated = 0
    skipped = 0
    pickup_cab_pending = 0

    async for vehicle in cursor:
        scanned += 1
        brand = str(vehicle.get("brand") or "").strip().upper()
        model = str(vehicle.get("model") or "").strip()
        descriptor = str(vehicle.get("descriptor") or "").strip()

        catalog_entry = label_index.get((brand, model))
        if catalog_entry:
            slug = str(catalog_entry.get("vehicle_type_slug") or catalog_entry.get("thumbnail_slug") or "")
            type_label = str(catalog_entry.get("vehicle_type_label") or "")
            source = str(catalog_entry.get("classification_source") or "catalog")
        elif brand and descriptor:
            classified = classify_descriptor(brand, descriptor, model=model)
            slug = classified.get("vehicle_type_slug") or ""
            type_label = classified.get("vehicle_type_label") or ""
            source = classified.get("classification_source") or "rules"
        elif brand and model:
            classified = classify_descriptor(brand, model, model=model)
            slug = classified.get("vehicle_type_slug") or ""
            type_label = classified.get("vehicle_type_label") or ""
            source = classified.get("classification_source") or "rules"
        else:
            skipped += 1
            continue

        if not slug:
            skipped += 1
            continue

        patch: dict[str, Any] = {
            "vehicle_type_slug": slug,
            "thumbnail_slug": slug,
            "classification_source": source,
        }
        if type_label:
            patch["vehicle_type"] = type_label

        if is_pickup_slug(slug):
            merged = apply_cab_to_vehicle_doc({**vehicle, **patch})
            patch.update({k: v for k, v in merged.items() if k in {"vehicle_type_slug", "thumbnail_slug", "vehicle_type", "vehicle_cab_variant"}})
            if not patch.get("vehicle_cab_variant"):
                pickup_cab_pending += 1

        if dry_run:
            updated += 1
            continue

        result = await db.vehicles.update_one({"vehicle_id": vehicle.get("vehicle_id")}, {"$set": patch})
        if result.modified_count:
            updated += 1
        else:
            skipped += 1

    return {
        "scanned": scanned,
        "updated": updated,
        "skipped": skipped,
        "pickup_cab_pending": pickup_cab_pending,
        "dry_run": dry_run,
    }