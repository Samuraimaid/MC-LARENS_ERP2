"""Versioned backups and rollback for the master vehicle catalog."""
from __future__ import annotations

import json
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from backend.domains.vehicles.catalog_paths import resolve_backend_data_dir, resolve_catalog_path

CATALOG_PATH = resolve_catalog_path()
HISTORY_DIR = resolve_backend_data_dir() / "vehicle-catalog-history"
CHANGELOG_PATH = HISTORY_DIR / "changelog.json"
MAX_VERSIONS = 30


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _load_changelog() -> list[dict[str, Any]]:
    if not CHANGELOG_PATH.exists():
        return []
    try:
        payload = json.loads(CHANGELOG_PATH.read_text(encoding="utf-8"))
        return list(payload.get("versions") or [])
    except Exception:
        return []


def _save_changelog(versions: list[dict[str, Any]]) -> None:
    HISTORY_DIR.mkdir(parents=True, exist_ok=True)
    CHANGELOG_PATH.write_text(
        json.dumps({"versions": versions[:MAX_VERSIONS]}, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


def backup_catalog_before_change(reason: str, *, meta: dict[str, Any] | None = None) -> dict[str, Any]:
    if not CATALOG_PATH.exists():
        raise FileNotFoundError(f"Catalog not found: {CATALOG_PATH}")

    HISTORY_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    version_id = f"v_{stamp}"
    backup_path = HISTORY_DIR / f"{version_id}.json"
    shutil.copy2(CATALOG_PATH, backup_path)

    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    entry = {
        "version_id": version_id,
        "created_at": _utc_now(),
        "reason": reason,
        "total_entries": len(catalog.get("entries") or []),
        "backup_file": backup_path.name,
        "meta": meta or {},
    }

    versions = _load_changelog()
    versions.insert(0, entry)
    _save_changelog(versions)

    while len(versions) > MAX_VERSIONS:
        removed = versions.pop()
        old_file = HISTORY_DIR / str(removed.get("backup_file") or "")
        if old_file.exists():
            old_file.unlink()

    return entry


def list_catalog_versions(*, limit: int = 20) -> list[dict[str, Any]]:
    return _load_changelog()[: max(1, min(limit, MAX_VERSIONS))]


def rollback_catalog_version(version_id: str) -> dict[str, Any]:
    versions = _load_changelog()
    match = next((v for v in versions if v.get("version_id") == version_id), None)
    if not match:
        raise FileNotFoundError(f"Version not found: {version_id}")

    backup_file = HISTORY_DIR / str(match.get("backup_file") or "")
    if not backup_file.exists():
        raise FileNotFoundError(f"Backup file missing: {backup_file}")

    backup_catalog_before_change("pre_rollback", meta={"rollback_target": version_id})
    shutil.copy2(backup_file, CATALOG_PATH)

    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    return {
        "version_id": version_id,
        "restored_at": _utc_now(),
        "total_entries": len(catalog.get("entries") or []),
        "message": "Catálogo restaurado desde respaldo",
    }