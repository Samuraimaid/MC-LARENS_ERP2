import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

from pymongo import MongoClient

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "mc-larens2_mundo_accesorios_erp")
OUTPUT_FILE = Path(os.environ.get("OUTPUT_FILE", "backend/data/seeds/core_seed.json"))

COLLECTIONS = [
    "users",
    "customers",
    "inventory",
    "products",
    "vehicles",
    "warehouses",
    "branches",
]


def _sanitize_docs(docs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    sanitized: List[Dict[str, Any]] = []
    for doc in docs:
        item = dict(doc)
        item.pop("_id", None)
        sanitized.append(item)
    return sanitized


def main() -> None:
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]

    payload: Dict[str, Any] = {
        "metadata": {
            "db_name": DB_NAME,
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "collections": COLLECTIONS,
        },
        "collections": {},
    }

    counts: Dict[str, int] = {}
    for name in COLLECTIONS:
        rows = list(db[name].find({}))
        clean_rows = _sanitize_docs(rows)
        payload["collections"][name] = clean_rows
        counts[name] = len(clean_rows)

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_FILE.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    print(json.dumps({"output_file": str(OUTPUT_FILE), "counts": counts}, ensure_ascii=False))


if __name__ == "__main__":
    main()
