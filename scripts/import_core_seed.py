import json
import os
from pathlib import Path
from typing import Any, Dict, List, Tuple

from pymongo import MongoClient

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "mc-larens2_mundo_accesorios_erp")
INPUT_FILE = Path(os.environ.get("INPUT_FILE", "backend/data/seeds/core_seed.json"))
OVERWRITE = os.environ.get("OVERWRITE", "false").strip().lower() in {"1", "true", "yes", "on"}

UNIQUE_KEYS: Dict[str, Tuple[str, ...]] = {
    "users": ("user_id",),
    "customers": ("customer_id",),
    "inventory": ("product_id", "warehouse_id"),
    "products": ("product_id",),
    "vehicles": ("vehicle_id",),
    "warehouses": ("warehouse_id",),
    "branches": ("branch_id",),
}


def _build_filter(doc: Dict[str, Any], keys: Tuple[str, ...]) -> Dict[str, Any]:
    filt: Dict[str, Any] = {}
    for key in keys:
        value = doc.get(key)
        if value is None:
            return {}
        filt[key] = value
    return filt


def main() -> None:
    if not INPUT_FILE.exists():
        raise SystemExit(f"Seed file not found: {INPUT_FILE}")

    payload = json.loads(INPUT_FILE.read_text(encoding="utf-8"))
    collections = payload.get("collections") or {}

    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]

    report: Dict[str, Dict[str, int]] = {}
    for name, docs in collections.items():
        if not isinstance(docs, list):
            continue

        inserted = 0
        updated = 0
        skipped = 0
        unique_keys = UNIQUE_KEYS.get(name)

        for raw in docs:
            if not isinstance(raw, dict):
                skipped += 1
                continue
            doc = dict(raw)
            doc.pop("_id", None)

            if not unique_keys:
                if OVERWRITE:
                    db[name].insert_one(doc)
                    inserted += 1
                else:
                    skipped += 1
                continue

            filt = _build_filter(doc, unique_keys)
            if not filt:
                skipped += 1
                continue

            existing = db[name].find_one(filt, {"_id": 1})
            if existing and not OVERWRITE:
                skipped += 1
                continue

            if existing and OVERWRITE:
                db[name].update_one(filt, {"$set": doc})
                updated += 1
            else:
                db[name].insert_one(doc)
                inserted += 1

        report[name] = {
            "inserted": inserted,
            "updated": updated,
            "skipped": skipped,
            "total_seed_rows": len(docs),
        }

    print(json.dumps({"input_file": str(INPUT_FILE), "overwrite": OVERWRITE, "report": report}, ensure_ascii=False))


if __name__ == "__main__":
    main()
