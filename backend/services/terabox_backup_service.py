"""TeraBox cold backup uploader — nightly async upload with 30-day retention."""
from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx

from backend.domains.deployment.appliance_cloud_config import resolve_terabox_credentials

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


async def _terabox_login(client: httpx.AsyncClient, username: str, password: str) -> bool:
    """Best-effort session bootstrap for TeraBox web API."""
    try:
        await client.get("https://www.terabox.com/", timeout=20.0)
        response = await client.post(
            "https://www.terabox.com/passport/login",
            data={"username": username, "password": password, "client": "web"},
            timeout=30.0,
        )
        if response.status_code in {200, 302}:
            return True
        alt = await client.post(
            "https://www.terabox.com/api/login",
            json={"username": username, "password": password},
            timeout=30.0,
        )
        return alt.status_code == 200
    except Exception:
        return False


async def _terabox_upload_file(client: httpx.AsyncClient, archive: Path, remote_folder: str) -> bool:
    try:
        with archive.open("rb") as handle:
            files = {"file": (archive.name, handle, "application/gzip")}
            response = await client.post(
                "https://www.terabox.com/api/upload",
                data={"path": remote_folder},
                files=files,
                timeout=600.0,
            )
        return response.status_code in {200, 201}
    except Exception:
        return False


async def upload_archive_to_terabox(archive_path: str) -> Dict[str, Any]:
    username, password = resolve_terabox_credentials()
    backup_root = Path(os.environ.get("BACKUP_INTERNAL_ROOT", "/app/backups"))
    archive = Path(archive_path)
    if not archive.exists():
        payload = {
            "connected": bool(username and password),
            "last_upload_status": "error",
            "last_upload_at": datetime.now(timezone.utc).isoformat(),
            "message": f"Archivo no encontrado: {archive}",
        }
        write_terabox_status(payload)
        return payload

    if not username or not password:
        payload = {
            "connected": False,
            "last_upload_status": "skipped",
            "last_upload_at": datetime.now(timezone.utc).isoformat(),
            "last_archive": archive.name,
            "message": "TERABOX_USERNAME/PASSWORD no configurados",
        }
        write_terabox_status(payload)
        return payload

    remote_folder = os.environ.get("TERABOX_REMOTE_FOLDER", "/MCLarensERP/cold-backups")
    branch_id = os.environ.get("BRANCH_ID", "branch_main")
    ok = False
    logged_in = False
    message = ""
    async with httpx.AsyncClient(follow_redirects=True) as client:
        logged_in = await _terabox_login(client, username, password)
        if not logged_in:
            message = "Login TeraBox fallido — verifique credenciales"
        else:
            ok = await _terabox_upload_file(client, archive, f"{remote_folder}/{branch_id}")
            message = "Exito" if ok else "Upload TeraBox fallido"

    used_bytes = sum(p.stat().st_size for p in _list_local_archives(backup_root))
    percent = round((used_bytes / TERABOX_FREE_BYTES) * 100, 2) if TERABOX_FREE_BYTES else None
    _prune_old_archives(backup_root)

    payload = {
        "connected": ok or logged_in,
        "last_upload_status": "success" if ok else "error",
        "last_upload_at": datetime.now(timezone.utc).isoformat(),
        "last_archive": archive.name,
        "space_used_percent": percent,
        "space_used_bytes": used_bytes,
        "space_limit_bytes": TERABOX_FREE_BYTES,
        "message": message,
        "branch_id": branch_id,
    }
    write_terabox_status(payload)
    return payload


def upload_archive_to_terabox_sync(archive_path: str) -> Dict[str, Any]:
    import asyncio

    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import concurrent.futures

            with concurrent.futures.ThreadPoolExecutor() as pool:
                return pool.submit(lambda: asyncio.run(upload_archive_to_terabox(archive_path))).result()
        return loop.run_until_complete(upload_archive_to_terabox(archive_path))
    except RuntimeError:
        return asyncio.run(upload_archive_to_terabox(archive_path))


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