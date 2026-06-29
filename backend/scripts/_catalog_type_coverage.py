"""Estimate how many catalog model lines can be auto-classified."""
from __future__ import annotations

import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CATALOG = ROOT / "frontend" / "src" / "data" / "vehicleCatalog.json"

RULES = [
    ("camioneta-cabina-y-media", ("doble cabina", "double cab", "crew cab", "crewman", "cabina y media")),
    ("camioneta-1-cabina", ("pickup", "cabina simple", "single cab")),
    ("hatchback", ("hatchback", "hatch/", "hatch ")),
    ("suv", ("suv", "crossover")),
    ("sedan", ("sedan", "sedán")),
    ("station-wagon", ("wagon", "familiar")),
    ("microbus-pasajeros", ("minivan", "microbus")),
    ("microbus-carga", ("van de carga", "cargo van")),
]


def infer(text: str) -> str | None:
    lowered = text.lower()
    for slug, keywords in RULES:
        if any(keyword in lowered for keyword in keywords):
            return slug
    return None


def main() -> None:
    entries = json.loads(CATALOG.read_text(encoding="utf-8"))["entries"]
    lines: dict[tuple[str, str], list[str]] = defaultdict(list)
    for entry in entries:
        lines[(entry["brand"], entry["descriptor"])].append(entry["label"])

    auto = 0
    for (brand, descriptor), labels in lines.items():
        blob = " ".join([brand, descriptor, *labels])
        if infer(blob):
            auto += 1

    print(f"catalog_entries={len(entries)}")
    print(f"unique_model_lines={len(lines)}")
    print(f"lines_rule_match={auto}")
    print(f"lines_need_research={len(lines) - auto}")
    print(f"pct_auto={round(100 * auto / len(lines), 1)}")

    hilux = [descriptor for (brand, descriptor) in lines if brand == "TOYOTA" and "hilux" in descriptor.lower()]
    print(f"toyota_hilux_lines={len(hilux)}")
    for descriptor in sorted(hilux):
        print(f"  - {descriptor}")


if __name__ == "__main__":
    main()