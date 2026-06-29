"""Validate vehicle type -> silhouette slug mapping for ERP catalog types."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT.parent) not in sys.path:
    sys.path.insert(0, str(ROOT.parent))

from backend.domains.vehicles.thumbnails import (  # noqa: E402
    BUNDLED_DIR,
    DEFAULT_SLUG,
    VEHICLE_THUMBNAIL_CATALOG,
    resolve_vehicle_thumbnail_slug,
    validate_slug,
)

EXPECTED = {
    "Hatchback": "hatchback",
    "Sedan": "sedan",
    "Sedán": "sedan",
    "Convertible": "convertible",
    "SUV": "suv",
    "Station Wagon": "station-wagon",
    "Camioneta 1 cabina": "camioneta-1-cabina",
    "Camioneta cabina y media": "camioneta-cabina-y-media",
    "Camioneta Doble Cabina": "camioneta-cabina-y-media",
    "Microbús de Carga": "microbus-carga",
    "Microbus de Pasajeros": "microbus-pasajeros",
    "Camion de Carga": "camion-carga",
    "Cabezal": "cabezal",
    "sedan": "sedan",
    "pickup": "camioneta-1-cabina",
}

def main() -> int:
    errors = []
    print("== Mapping checks ==")
    for raw, expected in EXPECTED.items():
        got = resolve_vehicle_thumbnail_slug(raw)
        ok = got == expected
        print(f"{'OK' if ok else 'FAIL'} {raw!r} -> {got} (expected {expected})")
        if not ok:
            errors.append((raw, got, expected))

    print("\n== Bundled assets ==")
    for item in VEHICLE_THUMBNAIL_CATALOG:
        slug = item["slug"]
        validate_slug(slug)
        path = BUNDLED_DIR / f"{slug}.png"
        exists = path.exists()
        print(f"{'OK' if exists else 'MISSING'} {slug}: {path}")
        if not exists:
            errors.append((slug, "missing_file", str(path)))

    default_path = BUNDLED_DIR / f"{DEFAULT_SLUG}.png"
    if not default_path.exists():
        print(f"MISSING default: {default_path}")
        errors.append((DEFAULT_SLUG, "missing_default", str(default_path)))
    else:
        print(f"OK default: {default_path}")

    if errors:
        print(f"\nFAILED with {len(errors)} issue(s)")
        return 1

    print("\nAll vehicle thumbnail mappings and bundled assets are OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())