import os

from backend.db.distributed import (
    resolve_central_mongo_uri,
    resolve_deployment_branch_id,
    resolve_local_mongo_uri,
)
from backend.services.inventory_central_sync import InventoryCentralSyncService


def test_resolve_local_mongo_uri_prefers_mongodb_local_uri(monkeypatch):
    monkeypatch.setenv("MONGODB_LOCAL_URI", "mongodb://local-store:27017")
    monkeypatch.setenv("MONGO_URL", "mongodb://legacy:27017")
    assert resolve_local_mongo_uri() == "mongodb://local-store:27017"


def test_resolve_central_mongo_uri_empty_by_default(monkeypatch):
    monkeypatch.delenv("MONGODB_CENTRAL_URI", raising=False)
    assert resolve_central_mongo_uri() is None


def test_inventory_central_sync_disabled_without_central_db():
    service = InventoryCentralSyncService(local_db=None, central_db=None, deployment_branch_id="branch_main")
    assert service.enabled is False


def test_resolve_deployment_branch_id_from_env(monkeypatch):
    monkeypatch.setenv("BRANCH_ID", "branch_north")
    assert resolve_deployment_branch_id() == "branch_north"