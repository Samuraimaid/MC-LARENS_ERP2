"""TeraBox cold backup uploader — real API upload with 30-day local retention."""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from backend.domains.deployment.appliance_cloud_config import resolve_terabox_settings
from backend.services.terabox_sdk import get_quota, upload_file

STATUS_FILENAME = "terabox_status.json"
RETENTION_DAYS = 30
TERABOX_FREE_BYTES = 1024 * 1024 * 1024 * 1024  # 1 TB


def _status_path() -> Path:
    root = Path(os.environ.get("BACKUP_INTERNAL_ROOT", "/app/backups"))
    root.mkdir(parents=True, exist_ok=True)
    return root / STATUS_FILENAME


def read_terabox_status() -> Dict[str, Any]:
    path = _status_path()
    if not path.exists():
        return {
            "connected": False,
            "last_upload_status": "never",
            "last_upload_at": None,
            "last_archive": None,
            "space_used_percent": None,
            "message": "Sin envios registrados",
        }
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {"connected": False, "last_upload_status": "error", "message": "Estado corrupto"}


def write_terabox_status(payload: Dict[str, Any]) -> None:
    path = _status_path()
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def _list_local_archives(backup_root: Path) -> List[Path]:
    if not backup_root.exists():
        return []
    return sorted(
        backup_root.glob("erp_delta_backup_*.tar.gz"),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )


def _prune_old_archives(backup_root: Path, keep_days: int = RETENTION_DAYS) -> int:
    removed = 0
    cutoff = datetime.now(timezone.utc).timestamp() - (keep_days * 86400)
    for path in _list_local_archives(backup_root):
        if path.stat().st_mtime < cutoff:
            try:
                path.unlink(missing_ok=True)
                removed += 1
            except OSError:
                pass
    return removed


def upload_archive_to_terabox(archive_path: str) -> Dict[str, Any]:
    backup_root = Path(os.environ.get("BACKUP_INTERNAL_ROOT", "/app/backups"))
    archive = Path(archive_path)
    settings = resolve_terabox_settings()
    branch_id = os.environ.get("BRANCH_ID", "branch_main")
    remote_folder = (settings.get("remote_folder") or "/MCLarensERP/cold-backups").rstrip("/")
    remote_dest = f"{remote_folder}/{branch_id}/{archive.name}"

    if not archive.exists():
        payload = {
            "connected": False,
            "last_upload_status": "error",
            "last_upload_at": datetime.now(timezone.utc).isoformat(),
            "message": f"Archivo no encontrado: {archive}",
        }
        write_terabox_status(payload)
        return payload

    ok = False
    message = ""
    remote_used = None
    try:
        result = upload_file(str(archive), remote_dest)
        ok = bool(result.get("ok"))
        message = result.get("message") or "Subida TeraBox completada"
        try:
            quota = get_quota()
            remote_used = int(quota.get("used") or 0)
        except Exception:
            remote_used = None
    except Exception as exc:
        message = f"Upload TeraBox fallido: {exc}"

    local_used = sum(p.stat().st_size for p in _list_local_archives(backup_root))
    used_bytes = remote_used if remote_used is not None else local_used
    percent = round((used_bytes / TERABOX_FREE_BYTES) * 100, 2) if TERABOX_FREE_BYTES else None
    _prune_old_archives(backup_root)

    payload = {
        "connected": ok,
        "last_upload_status": "success" if ok else "error",
        "last_upload_at": datetime.now(timezone.utc).isoformat(),
        "last_archive": archive.name,
        "last_remote_path": remote_dest if ok else None,
        "space_used_percent": percent,
        "space_used_bytes": used_bytes,
        "space_limit_bytes": TERABOX_FREE_BYTES,
        "message": message,
        "branch_id": branch_id,
    }
    write_terabox_status(payload)
    return payload


def upload_archive_to_terabox_sync(archive_path: str) -> Dict[str, Any]:
    return upload_archive_to_terabox(archive_path)


def format_terabox_indicator(status: Optional[Dict[str, Any]] = None) -> str:
    data = status or read_terabox_status()
    connected = "CONECTADO" if data.get("connected") else "DESCONECTADO"
    last = data.get("last_upload_status") or "never"
    last_at = data.get("last_upload_at")
    time_label = "N/D"
    if last_at:
        try:
            dt = datetime.fromisoformat(str(last_at).replace("Z", "+00:00"))
            time_label = dt.astimezone(timezone.utc).strftime("%I:%M %p").lstrip("0")
        except ValueError:
            time_label = str(last_at)[:16]
    pct = data.get("space_used_percent")
    pct_label = f"{pct}%" if pct is not None else "N/D"
    return f"[CLOUDBACKUP] TeraBox: {connected} | Ultimo envio: {last.title()} ({time_label}) | Espacio: {pct_label} de 1 TB"