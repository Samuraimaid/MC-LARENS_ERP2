"""Audit vehicle catalog coverage, duplicates and silhouette assignment."""
from __future__ import annotations

import re
import unicodedata
from collections import Counter, defaultdict
from typing import Any

from backend.domains.vehicles.vehicle_cab import PICKUP_SLUGS


def _norm(value: str) -> str:
    text = unicodedata.normalize("NFD", str(value or ""))
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    return re.sub(r"\s+", " ", text).strip().lower()


def _model_base(descriptor: str) -> str:
    return _norm(descriptor.split("(", 1)[0])


def _parse_years(descriptor: str) -> tuple[int | None, int | None]:
    token = re.search(r"\[(.*?)\]", descriptor or "")
    if not token:
        return None, None
    raw = token.group(1)
    direct = re.match(r"^(\d{4})\s*-\s*(\d{4})$", raw)
    if direct:
        return int(direct.group(1)), int(direct.group(2))
    present = re.match(r"^(\d{4})\s*-\s*(Presente|Actualidad)$", raw, flags=re.I)
    if present:
        return int(present.group(1)), 2100
    single = re.match(r"^(\d{4})$", raw)
    if single:
        year = int(single.group(1))
        return year, year
    return None, None


def audit_catalog_entries(entries: list[dict[str, Any]]) -> dict[str, Any]:
    by_label: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    by_descriptor: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    missing_slug: list[dict[str, str]] = []
    brand_stats: dict[str, dict[str, int]] = defaultdict(lambda: {"entries": 0, "lines": 0})

    lines_per_brand: dict[str, set[str]] = defaultdict(set)

    for entry in entries:
        brand = str(entry.get("brand") or "").strip()
        descriptor = str(entry.get("descriptor") or "").strip()
        label = str(entry.get("label") or "").strip()
        if not brand or not descriptor:
            continue

        by_label[(brand, _norm(label))].append(entry)
        by_descriptor[(brand, _norm(descriptor))].append(entry)
        lines_per_brand[brand].add(descriptor)
        brand_stats[brand]["entries"] += 1

        if not str(entry.get("vehicle_type_slug") or "").strip():
            missing_slug.append({"brand": brand, "descriptor": descriptor, "label": label})

    duplicate_labels = [
        {
            "brand": brand,
            "label": rows[0].get("label"),
            "count": len(rows),
            "ids": [row.get("id") for row in rows],
        }
        for (brand, _), rows in by_label.items()
        if len(rows) > 1
    ]

    # Alias / overlap groups: same brand + similar model base + different descriptors.
    overlap_groups: list[dict[str, Any]] = []
    grouped: dict[tuple[str, str], list[str]] = defaultdict(list)
    for brand, descriptors in lines_per_brand.items():
        for descriptor in descriptors:
            grouped[(brand, _model_base(descriptor))].append(descriptor)

    for (brand, model_base), descriptors in grouped.items():
        if len(descriptors) < 2:
            continue
        unique_desc = sorted(set(descriptors))
        if len(unique_desc) < 2:
            continue
        overlap_groups.append(
            {
                "brand": brand,
                "model_base": model_base,
                "descriptors": unique_desc,
                "reason": "alias_or_duplicate_generation",
            }
        )

    for brand, descriptors in lines_per_brand.items():
        brand_stats[brand]["lines"] = len(descriptors)

    source_counter: Counter[str] = Counter()
    slug_counter: Counter[str] = Counter()
    pickup_ambiguous: list[dict[str, str]] = []

    for entry in entries:
        slug = str(entry.get("vehicle_type_slug") or "").strip()
        if slug:
            slug_counter[slug] += 1
        source = str(entry.get("classification_source") or "unknown").strip() or "unknown"
        source_counter[source] += 1

        if slug in PICKUP_SLUGS:
            descriptor = str(entry.get("descriptor") or "")
            combined = _norm(f"{descriptor} {entry.get('label') or ''}")
            has_cab_hint = any(
                token in combined
                for token in (
                    "doble cabina",
                    "double cab",
                    "crew cab",
                    "cabina y media",
                    "extended cab",
                    "1 cabina",
                    "single cab",
                    "cabina simple",
                )
            )
            if not has_cab_hint:
                pickup_ambiguous.append(
                    {
                        "brand": str(entry.get("brand") or ""),
                        "label": str(entry.get("label") or ""),
                        "vehicle_type_slug": slug,
                    }
                )

    total_with_slug = sum(slug_counter.values())
    override_count = source_counter.get("override", 0)
    rules_count = source_counter.get("rules", 0)
    web_sync_count = source_counter.get("web_sync", 0)
    classified_total = override_count + rules_count + web_sync_count

    quality_metrics = {
        "classification_sources": dict(source_counter),
        "override_pct": round((override_count / classified_total) * 100, 1) if classified_total else 0,
        "rules_pct": round((rules_count / classified_total) * 100, 1) if classified_total else 0,
        "web_sync_pct": round((web_sync_count / classified_total) * 100, 1) if classified_total else 0,
        "slug_distribution": dict(slug_counter.most_common(20)),
        "pickup_entries": sum(slug_counter.get(slug, 0) for slug in PICKUP_SLUGS),
        "pickup_without_cab_hint": len(pickup_ambiguous),
        "coverage_pct": round((total_with_slug / len(entries)) * 100, 1) if entries else 100,
    }

    return {
        "total_entries": len(entries),
        "total_brands": len(lines_per_brand),
        "total_lines": sum(len(v) for v in lines_per_brand.values()),
        "missing_vehicle_type_slug": len(missing_slug),
        "duplicate_labels": duplicate_labels,
        "overlap_groups": overlap_groups[:200],
        "quality_metrics": quality_metrics,
        "pickup_ambiguous_samples": pickup_ambiguous[:30],
        "brands": {
            brand: {
                "entries": stats["entries"],
                "lines": stats["lines"],
            }
            for brand, stats in sorted(brand_stats.items())
        },
        "missing_samples": missing_slug[:50],
    }