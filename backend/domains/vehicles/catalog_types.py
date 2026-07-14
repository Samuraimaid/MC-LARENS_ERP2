"""Rebuild catalog silhouette assignments and descriptor profiles."""
from __future__ import annotations

import json
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

from backend.domains.vehicles.catalog_audit import audit_catalog_entries
from backend.domains.vehicles.descriptor_classifier import classify_descriptor

from backend.domains.vehicles.catalog_paths import resolve_backend_data_dir, resolve_catalog_path

_REPO_ROOT = Path(__file__).resolve().parents[3]
CATALOG_PATH = resolve_catalog_path()
FE_TYPES_PATH = _REPO_ROOT / "frontend" / "src" / "data" / "vehicleDescriptorTypes.json"
BE_TYPES_PATH = resolve_backend_data_dir() / "vehicle-descriptor-types.json"
AUDIT_PATH = resolve_backend_data_dir() / "vehicle-catalog-audit.json"


def _engine_tokens(labels: list[str]) -> list[str]:
    engines: list[str] = []
    for label in labels:
        token = label.rsplit(" - ", 1)[-1].strip()
        if token:
            engines.append(token)
    return sorted(set(engines))


def rebuild_catalog_types() -> dict[str, int]:
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    entries: list[dict] = list(catalog.get("entries") or [])

    profiles: dict[str, dict] = {}
    lines: dict[str, list[str]] = defaultdict(list)

    for entry in entries:
        brand = str(entry.get("brand") or "").strip()
        descriptor = str(entry.get("descriptor") or "").strip()
        model = str(entry.get("model") or "").strip()
        if not brand or not descriptor:
            continue

        classified = classify_descriptor(
            brand,
            descriptor,
            model=model,
            refresh_stale_overrides=True,
        )
        slug = classified["vehicle_type_slug"]
        type_label = classified["vehicle_type_label"]

        entry["vehicle_type_slug"] = slug
        entry["vehicle_type_label"] = type_label
        entry["thumbnail_slug"] = slug
        entry["classification_source"] = classified.get("classification_source", "rules")

        key = f"{brand.upper()}::{descriptor}"
        lines[key].append(str(entry.get("label") or ""))

        if key not in profiles:
            profiles[key] = {
                "default_silhouette_slug": slug,
                "body_family": classified.get("body_family"),
                "catalog_status": classified.get("catalog_status", "auto"),
                "classification_source": classified.get("classification_source", "rules"),
            }

    for key, labels in lines.items():
        profiles[key]["catalog_engines"] = _engine_tokens(labels)

    audit = audit_catalog_entries(entries)

    types_doc = {
        "version": 2,
        "updated_at": datetime.now(timezone.utc).date().isoformat(),
        "notes": (
            "Perfiles por marca+descriptor con silueta pre-asignada. "
            "Cada entrada del catálogo incluye vehicle_type_slug para uso directo en tarjetas."
        ),
        "entries": dict(sorted(profiles.items())),
    }
    text = json.dumps(types_doc, indent=2, ensure_ascii=False) + "\n"
    FE_TYPES_PATH.write_text(text, encoding="utf-8")
    BE_TYPES_PATH.write_text(text, encoding="utf-8")
    AUDIT_PATH.write_text(json.dumps(audit, indent=2, ensure_ascii=False), encoding="utf-8")

    catalog["entries"] = entries
    catalog["total_rows"] = len(entries)
    catalog["vehicle_types_version"] = types_doc["updated_at"]
    catalog["generated_at_utc"] = datetime.now(timezone.utc).isoformat()
    CATALOG_PATH.write_text(json.dumps(catalog, ensure_ascii=False, indent=2), encoding="utf-8")

    return {
        "entries": len(entries),
        "profiles": len(profiles),
        "missing_slug": audit.get("missing_vehicle_type_slug", 0),
        "duplicate_labels": len(audit.get("duplicate_labels") or []),
        "overlap_groups": len(audit.get("overlap_groups") or []),
    }