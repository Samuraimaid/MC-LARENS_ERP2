"""TeraBox cloud quota overview — HTTP client simulation + local footprint."""
from __future__ import annotations

import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

import requests

TERABOX_TOTAL_BYTES = 1_099_511_627_776  # 1 TB
REQUIRED_FOLDERS = ("/productos", "/evidencias_taller", "/backups_sistema")


def _backup_root() -> Path:
    return Path(os.environ.get("BACKUP_INTERNAL_ROOT", "/app/backups"))


def _upload_root() -> Path:
    return Path(os.environ.get("LOCAL_UPLOAD_ROOT", "/app/uploads"))


def _dir_size(path: Path) -> int:
    if not path.exists():
        return 0
    total = 0
    for item in path.rglob("*"):
        if item.is_file():
            try:
                total += item.stat().st_size
            except OSError:
                continue
    return total


def _local_used_bytes() -> int:
    backup_used = sum(
        p.stat().st_size
        for p in _backup_root().glob("erp_delta_backup_*.tar.gz")
        if p.is_file()
    )
    deliveries_used = _dir_size(_upload_root() / "deliveries")
    evidence_used = _dir_size(_upload_root() / "evidencias_taller")
    products_used = _dir_size(_upload_root() / "productos")
    return int(backup_used + deliveries_used + evidence_used + products_used)


def _terabox_login(session: requests.Session, username: str, password: str) -> bool:
    try:
        session.get("https://www.terabox.com/", timeout=15)
        response = session.post(
            "https://www.terabox.com/passport/login",
            data={"username": username, "password": password, "client": "web"},
            timeout=20,
        )
        if response.status_code in {200, 302}:
            return True
        alt = session.post(
            "https://www.terabox.com/api/login",
            json={"username": username, "password": password},
            timeout=20,
        )
        return alt.status_code == 200
    except requests.RequestException:
        return False


def _remote_used_hint(session: requests.Session, root_folder: str) -> int | None:
    try:
        response = session.get(
            "https://www.terabox.com/api/quota",
            params={"path": root_folder},
            timeout=20,
        )
        if response.status_code != 200:
            return None
        payload = response.json()
        for key in ("used", "used_size", "used_bytes"):
            if key in payload:
                return int(payload[key])
        data = payload.get("data") or {}
        for key in ("used", "used_size", "used_bytes"):
            if key in data:
                return int(data[key])
    except (requests.RequestException, ValueError, TypeError):
        return None
    return None


def _folder_rows(root_folder: str, used_bytes: int) -> List[Dict[str, Any]]:
    upload_root = _upload_root()
    backup_root = _backup_root()
    mapping = {
        "/productos": upload_root / "productos",
        "/evidencias_taller": upload_root / "deliveries",
        "/backups_sistema": backup_root,
    }
    rows: List[Dict[str, Any]] = []
    for name in REQUIRED_FOLDERS:
        local_path = mapping.get(name, upload_root / name.strip("/"))
        local_bytes = _dir_size(local_path) if local_path.exists() else 0
        remote_path = f"{root_folder.rstrip('/')}{name}"
        rows.append(
            {
                "name": name,
                "remote_path": remote_path,
                "local_mirror": str(local_path),
                "size_bytes": local_bytes,
                "exists_locally": local_path.exists(),
                "status": "ok" if local_path.exists() or local_bytes > 0 else "pending",
            }
        )
    if used_bytes and rows:
        total_local = sum(int(r.get("size_bytes") or 0) for r in rows) or 1
        for row in rows:
            row["share_percent"] = round((int(row.get("size_bytes") or 0) / total_local) * 100, 2)
    return rows


def build_terabox_overview() -> Dict[str, Any]:
    username = (os.environ.get("TERABOX_USERNAME") or "").strip()
    password = (os.environ.get("TERABOX_PASSWORD") or "").strip()
    root_folder = (os.environ.get("TERABOX_ROOT_FOLDER") or "/MCLarensERP").strip() or "/MCLarensERP"

    used_local = _local_used_bytes()
    used_remote: int | None = None
    connected = False
    message = "Modo estimado por volcados locales"

    if username and password:
        session = requests.Session()
        connected = _terabox_login(session, username, password)
        if connected:
            used_remote = _remote_used_hint(session, root_folder)
            message = "Sesión TeraBox activa"
        else:
            message = "Credenciales TeraBox configuradas — login no confirmado"

    used_bytes = int(used_remote if used_remote is not None else used_local)
    available_bytes = max(0, TERABOX_TOTAL_BYTES - used_bytes)
    used_percentage = round((used_bytes / TERABOX_TOTAL_BYTES) * 100, 2) if TERABOX_TOTAL_BYTES else 0.0

    return {
        "connected": connected,
        "root_folder": root_folder,
        "total_space_bytes": TERABOX_TOTAL_BYTES,
        "used_space_bytes": used_bytes,
        "available_space_bytes": available_bytes,
        "used_percentage": used_percentage,
        "folders": _folder_rows(root_folder, used_bytes),
        "message": message,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }