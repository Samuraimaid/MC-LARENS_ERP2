from __future__ import annotations

import os
from typing import Any, Optional

from pymongo import MongoClient

_client: Optional[MongoClient] = None
_db: Any = None


def get_sync_client() -> MongoClient:
    global _client, _db
    if _client is None:
        mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
        mongo_db = os.environ.get("MONGO_DB", os.environ.get("DB_NAME", "mc-larens2_erp"))
        _client = MongoClient(
            mongo_url,
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=5000,
        )
        _db = _client[mongo_db]
    return _client


def get_collection(name: str) -> Any:
    get_sync_client()
    return _db[name]
