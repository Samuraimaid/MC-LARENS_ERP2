"""TeraBox session client — credentials, listing and connection tests."""
from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from backend.domains.deployment.appliance_cloud_config import resolve_terabox_settings
from backend.services.terabox_sdk import clear_terabox_cache
from backend.services.terabox_sdk import list_directory as sdk_list_directory
from backend.services.terabox_sdk import test_connection as sdk_test_connection


def test_terabox_connection(
    username: Optional[str] = None,
    password: Optional[str] = None,
    *,
    force: bool = False,
) -> Dict[str, Any]:
    if username or password:
        import os as _os

        if username:
            _os.environ["TERABOX_USERNAME"] = str(username).strip()
        if password:
            _os.environ["TERABOX_PASSWORD"] = str(password).strip()
        from backend.domains.deployment.appliance_cloud_config import clear_appliance_cloud_cache

        clear_appliance_cloud_cache()
        clear_terabox_cache()
        force = True
    result = sdk_test_connection(force=force)
    if not force and result.get("connected"):
        result = {**result, "from_cache": True}
    return result


def list_terabox_directory(remote_path: Optional[str] = None) -> Dict[str, Any]:
    settings = resolve_terabox_settings()
    directory = _normalize_dir(remote_path or settings.get("root_folder") or "/MCLarensERP")

    remote = sdk_list_directory(directory)
    if remote.get("source") == "remote" and remote.get("connected"):
        return remote

    remote_error = remote.get("remote_error") or remote.get("message")
    local_entries = _list_local_fallback(directory, settings)
    return {
        "connected": False,
        "path": directory,
        "entries": local_entries,
        "message": (
            "No hay acceso remoto a TeraBox — mostrando copias locales pendientes de subir. "
            f"Detalle: {remote_error}"
        ),
        "source": "local_fallback",
        "remote_error": remote_error,
    }


def _normalize_dir(path: str) -> str:
    raw = str(path or "/").strip() or "/"
    if not raw.startswith("/"):
        raw = f"/{raw}"
    return raw.rstrip("/") or "/"


def _list_local_fallback(directory: str, settings: Dict[str, str]) -> List[Dict[str, Any]]:
    backup_root = os.environ.get("BACKUP_INTERNAL_ROOT", "/app/backups")
    upload_root = os.environ.get("LOCAL_UPLOAD_ROOT", "/app/uploads")
    remote_folder = settings.get("remote_folder") or "/MCLarensERP/cold-backups"
    entries: List[Dict[str, Any]] = []

    if directory.rstrip("/") == remote_folder.rstrip("/") or directory.startswith(remote_folder):
        from pathlib import Path

        for path in sorted(Path(backup_root).glob("erp_delta_backup_*.tar.gz"), reverse=True):
            entries.append({
                "name": path.name,
                "path": f"{remote_folder}/{path.name}",
                "is_dir": False,
                "size_bytes": path.stat().st_size,
                "modified_at": datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc).isoformat(),
                "source": "local_pending_upload",
            })

    if directory in {"/MCLarensERP", "/MCLarensERP/evidencias_taller", "/evidencias_taller"}:
        from pathlib import Path

        dlv = Path(upload_root) / "deliveries"
        if dlv.exists():
            for path in sorted(dlv.glob("*.jpg"), reverse=True)[:50]:
                entries.append({
                    "name": path.name,
                    "path": f"/MCLarensERP/evidencias_taller/{path.name}",
                    "is_dir": False,
                    "size_bytes": path.stat().st_size,
                    "modified_at": datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc).isoformat(),
                    "source": "local_mirror",
                })

    return entries