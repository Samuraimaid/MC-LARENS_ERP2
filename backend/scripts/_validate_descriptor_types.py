"""Validate curated descriptor type profiles against the vehicle catalog."""
from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CATALOG = ROOT / "frontend" / "src" / "data" / "vehicleCatalog.json"
PROFILES = ROOT / "backend" / "data" / "vehicle-descriptor-types.json"


def catalog_engine_tokens(labels: list[str]) -> list[str]:
    engines: list[str] = []
    for label in labels:
        token = label.rsplit(" - ", 1)[-1].strip()
        if token:
            engines.append(token)
    return sorted(set(engines))


def main() -> None:
    entries = json.loads(CATALOG.read_text(encoding="utf-8"))["entries"]
    profiles = json.loads(PROFILES.read_text(encoding="utf-8"))["entries"]

    lines: dict[str, list[str]] = defaultdict(list)
    for entry in entries:
        key = f"{entry['brand'].upper()}::{entry['descriptor']}"
        lines[key].append(entry["label"])

    print(f"profile_count={len(profiles)}")
    print(f"catalog_line_count={len(lines)}")
    print()

    for key in sorted(profiles):
        profile = profiles[key]
        labels = lines.get(key, [])
        catalog_engines = catalog_engine_tokens(labels)
        documented = profile.get("catalog_engines") or []
        print(f"== {key}")
        print(f"   silhouette={profile.get('default_silhouette_slug')}")
        print(f"   cabs={profile.get('cab_variants')}")
        print(f"   engines_doc={profile.get('engine_variants')}")
        print(f"   engines_catalog={catalog_engines}")
        print(f"   status={profile.get('catalog_status')}")
        if documented and catalog_engines and set(documented) != set(catalog_engines):
            print(f"   WARN documented_engines mismatch: {documented}")
        if not labels:
            print("   WARN no catalog entries for this descriptor")
        print()


if __name__ == "__main__":
    main()