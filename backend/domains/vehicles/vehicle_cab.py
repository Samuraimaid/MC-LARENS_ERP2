"""Pickup cab variant mapping for silhouette resolution."""
from __future__ import annotations

from typing import Any

PICKUP_SLUGS = frozenset({"camioneta-1-cabina", "camioneta-cabina-y-media"})

CAB_VARIANTS: dict[str, dict[str, str]] = {
    "single": {
        "slug": "camioneta-1-cabina",
        "label": "1 cabina",
        "vehicle_type": "Camioneta 1 Cabina",
    },
    "extended": {
        "slug": "camioneta-cabina-y-media",
        "label": "Cabina y media",
        "vehicle_type": "Camioneta Cabina y Media",
    },
    "double": {
        "slug": "camioneta-cabina-y-media",
        "label": "Doble cabina",
        "vehicle_type": "Camioneta Doble Cabina",
    },
}

VPIC_CAB_HINTS: dict[str, str] = {
    "single cab": "single",
    "regular cab": "single",
    "standard cab": "single",
    "extended cab": "extended",
    "extended cab pickup": "extended",
    "crew cab": "double",
    "crew cab pickup": "double",
    "double cab": "double",
}


def is_pickup_slug(slug: str | None) -> bool:
    return str(slug or "").strip().lower() in PICKUP_SLUGS


def normalize_cab_variant(value: str | None) -> str | None:
    raw = str(value or "").strip().lower().replace(" ", "-").replace("_", "-")
    aliases = {
        "1-cabina": "single",
        "una-cabina": "single",
        "cabina-simple": "single",
        "single": "single",
        "cabina-y-media": "extended",
        "extended": "extended",
        "doble-cabina": "double",
        "double": "double",
        "crew": "double",
    }
    return aliases.get(raw)


def infer_cab_variant_from_vpic(body_class: str = "") -> str | None:
    raw = str(body_class or "").strip().lower()
    if not raw:
        return None
    for hint, variant in VPIC_CAB_HINTS.items():
        if hint in raw:
            return variant
    return None


def resolve_pickup_slug(
    base_slug: str | None,
    cab_variant: str | None = None,
    *,
    body_class: str = "",
) -> dict[str, Any] | None:
    if not is_pickup_slug(base_slug):
        return None

    variant = normalize_cab_variant(cab_variant) or infer_cab_variant_from_vpic(body_class)
    if not variant:
        return {
            "vehicle_type_slug": str(base_slug),
            "vehicle_type_label": CAB_VARIANTS.get("double", {})["vehicle_type"]
            if base_slug == "camioneta-cabina-y-media"
            else CAB_VARIANTS["single"]["vehicle_type"],
            "vehicle_cab_variant": None,
            "cab_variant_required": True,
        }

    profile = CAB_VARIANTS[variant]
    return {
        "vehicle_type_slug": profile["slug"],
        "vehicle_type_label": profile["vehicle_type"],
        "vehicle_cab_variant": variant,
        "cab_variant_required": False,
    }


def apply_cab_to_vehicle_doc(doc: dict[str, Any]) -> dict[str, Any]:
    base_slug = str(doc.get("vehicle_type_slug") or doc.get("thumbnail_slug") or "").strip()
    if not is_pickup_slug(base_slug):
        return doc

    resolved = resolve_pickup_slug(
        base_slug,
        str(doc.get("vehicle_cab_variant") or ""),
        body_class=str(doc.get("body_class") or doc.get("vpic_body_class") or ""),
    )
    if not resolved:
        return doc

    doc["vehicle_type_slug"] = resolved["vehicle_type_slug"]
    doc["thumbnail_slug"] = resolved["vehicle_type_slug"]
    if resolved.get("vehicle_cab_variant"):
        doc["vehicle_cab_variant"] = resolved["vehicle_cab_variant"]
    if resolved.get("vehicle_type_label"):
        doc["vehicle_type"] = resolved["vehicle_type_label"]
    return doc