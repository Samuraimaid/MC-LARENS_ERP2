from __future__ import annotations

import logging
import os
from typing import Any, Optional

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

logger = logging.getLogger("erp.distributed")

_local_client: Optional[AsyncIOMotorClient] = None
_central_client: Optional[AsyncIOMotorClient] = None


def resolve_local_mongo_uri() -> str:
    return (
        os.environ.get("MONGODB_LOCAL_URI")
        or os.environ.get("MONGO_URL")
        or "mongodb://localhost:27017"
    )


def resolve_central_mongo_uri() -> Optional[str]:
    try:
        from backend.domains.deployment.appliance_cloud_config import resolve_central_mongo_uri as _resolve

        return _resolve()
    except Exception:
        uri = (os.environ.get("MONGODB_CENTRAL_URI") or "").strip()
        return uri or None


def resolve_database_name() -> str:
    return os.environ.get(
        "MONGO_DB",
        os.environ.get("DB_NAME", "mc-larens2_erp"),
    )


def resolve_deployment_branch_id() -> Optional[str]:
    branch_id = (os.environ.get("BRANCH_ID") or os.environ.get("DEFAULT_BRANCH_ID") or "").strip()
    return branch_id or None


def get_local_client() -> AsyncIOMotorClient:
    global _local_client
    if _local_client is None:
        _local_client = AsyncIOMotorClient(
            resolve_local_mongo_uri(),
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=5000,
        )
    return _local_client


def get_central_client() -> Optional[AsyncIOMotorClient]:
    global _central_client
    uri = resolve_central_mongo_uri()
    if not uri:
        return None
    if _central_client is None:
        _central_client = AsyncIOMotorClient(
            uri,
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=5000,
        )
        logger.info("Central MongoDB client initialized for cross-branch inventory sync")
    return _central_client


def get_local_database() -> AsyncIOMotorDatabase:
    return get_local_client()[resolve_database_name()]


def get_central_database() -> Optional[AsyncIOMotorDatabase]:
    client = get_central_client()
    if client is None:
        return None
    central_db_name = (
        os.environ.get("MONGODB_CENTRAL_DB")
        or os.environ.get("CENTRAL_DB_NAME")
        or resolve_database_name()
    )
    return client[central_db_name]


async def ping_central_database() -> bool:
    central_db = get_central_database()
    if central_db is None:
        return False
    try:
        await central_db.command("ping")
        return True
    except Exception:
        logger.exception("Central MongoDB ping failed")
        return False