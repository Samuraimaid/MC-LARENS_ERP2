"""Assign silhouette slug to every catalog entry and rebuild descriptor profiles."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.domains.vehicles.catalog_types import rebuild_catalog_types  # noqa: E402


def main() -> None:
    stats = rebuild_catalog_types()
    print("Catalog silhouette assignment complete:")
    for key, value in stats.items():
        print(f"  {key}={value}")


if __name__ == "__main__":
    main()