"""Quick checks for vehicle thumbnail slug resolution."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.domains.vehicles.type_resolver import resolve_vehicle_record_slug

CASES = [
    ({"vehicle_type": "Camioneta Doble Cabina", "brand": "TOYOTA", "model": "Hilux"}, "camioneta-cabina-y-media"),
    ({"vehicle_type": "Hatchback Large", "brand": "KIA", "model": "Rio"}, "hatchback"),
    ({"brand": "HOLDEN", "model": "Crewman (pickup doble cabina) [2003-2007] - V6 [G]"}, "camioneta-cabina-y-media"),
    ({"vehicle_type": "sedan", "brand": "HOLDEN", "model": "Crewman (pickup doble cabina) [2003-2007] - V6 [G]"}, "camioneta-cabina-y-media"),
    ({"brand": "TOYOTA", "model": "Corolla"}, None),
    ({}, None),
    ({"vehicle_id": "sale-without-vehicle"}, None),
]


def main() -> None:
    failed = 0
    for vehicle, expected in CASES:
        slug = resolve_vehicle_record_slug(vehicle, allow_default=False)
        ok = slug == expected
        status = "OK" if ok else "FAIL"
        print(f"{status} expected={expected!r} got={slug!r} vehicle={vehicle}")
        if not ok:
            failed += 1
    if failed:
        raise SystemExit(1)
    print("vehicle_type_mapping_ok")


if __name__ == "__main__":
    main()