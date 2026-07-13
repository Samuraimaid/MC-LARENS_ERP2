"""TeraBox session client — credentials, listing and connection tests."""
from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import requests

from backend.domains.deployment.appliance_cloud_config import (
    resolve_terabox_credentials,
    resolve_terabox_settings,
)

TERABOX_BASE = "https://www.terabox.com"
LIST_ENDPOINTS = (
    "/api/list",
    "/share/list",
)


def _normalize_dir(path: str) -> str:
    raw = str(path or "/").strip() or "/"
    if not raw.startswith("/"):
        raw = f"/{raw}"
    return raw.rstrip("/") or "/"


def _login_session(username: str, password: str) -> Tuple[Optional[requests.Session], str]:
    if not username or not password:
        return None, "Credenciales TeraBox no configuradas"
    session = requests.Session()
    session.headers.update({"User-Agent": "MCLarensERP-TeraBoxClient/1.0"})
    try:
        session.get(f"{TERABOX_BASE}/", timeout=20)
        response = session.post(
            f"{TERABOX_BASE}/passport/login",
            data={"username": username, "password": password, "client": "web"},
            timeout=25,
        )
        if response.status_code in {200, 302}:
            return session, "Sesión TeraBox activa"
        alt = session.post(
            f"{TERABOX_BASE}/api/login",
            json={"username": username, "password": password},
            timeout=25,
        )
        if alt.status_code == 200:
            return session, "Sesión TeraBox activa"
        return None, "Login TeraBox fallido — verifique usuario y contraseña"
    except requests.RequestException as exc:
        return None, f"Error de red TeraBox: {exc}"


def test_terabox_connection(
    username: Optional[str] = None,
    password: Optional[str] = None,
) -> Dict[str, Any]:
    user, pwd = resolve_terabox_credentials()
    if username:
        user = str(username).strip()
    if password:
        pwd = str(password).strip()
    session, message = _login_session(user, pwd)
    return {
        "connected": session is not None,
        "message": message,
        "username": user,
        "tested_at": datetime.now(timezone.utc).isoformat(),
    }


def _parse_list_payload(payload: Any) -> List[Dict[str, Any]]:
    if not isinstance(payload, dict):
        return []
    data = payload.get("data") if isinstance(payload.get("data"), dict) else payload
    rows = data.get("list") if isinstance(data, dict) else None
    if not isinstance(rows, list):
        rows = payload.get("list")
    if not isinstance(rows, list):
        return []

    parsed: List[Dict[str, Any]] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        is_dir = bool(row.get("isdir") in {1, "1", True} or row.get("is_dir"))
        name = str(row.get("server_filename") or row.get("filename") or row.get("name") or "")
        path = str(row.get("path") or "")
        size = int(row.get("size") or row.get("file_size") or 0)
        mtime = row.get("server_mtime") or row.get("mtime") or row.get("modified_at")
        parsed.append({
            "name": name,
            "path": path,
            "is_dir": is_dir,
            "size_bytes": size,
            "modified_at": mtime,
            "fs_id": row.get("fs_id") or row.get("fsid"),
        })
    return parsed


def list_terabox_directory(remote_path: Optional[str] = None) -> Dict[str, Any]:
    settings = resolve_terabox_settings()
    directory = _normalize_dir(remote_path or settings.get("root_folder") or "/MCLarensERP")
    username, password = resolve_terabox_credentials()
    session, message = _login_session(username, password)
    if session is None:
        return {
            "connected": False,
            "path": directory,
            "entries": [],
            "message": message,
        }

    last_error = message
    for endpoint in LIST_ENDPOINTS:
        try:
            response = session.get(
                f"{TERABOX_BASE}{endpoint}",
                params={"dir": directory, "page": 1, "num": 200, "order": "time", "desc": 1},
                timeout=25,
            )
            if response.status_code != 200:
                last_error = f"{endpoint} HTTP {response.status_code}"
                continue
            payload = response.json()
            if int(payload.get("errno", 0) or 0) not in {0, None}:
                last_error = str(payload.get("errmsg") or payload.get("message") or "list error")
                continue
            entries = _parse_list_payload(payload)
            if entries or payload.get("errno") == 0:
                return {
                    "connected": True,
                    "path": directory,
                    "entries": entries,
                    "message": "Listado remoto TeraBox",
                    "source": endpoint,
                }
        except (requests.RequestException, ValueError, TypeError) as exc:
            last_error = str(exc)

    return {
        "connected": True,
        "path": directory,
        "entries": _list_local_fallback(directory, settings),
        "message": (
            "Listado remoto no disponible con login web; mostrando espejo local de respaldos"
            if last_error else "Espejo local"
        ),
        "source": "local_fallback",
        "remote_error": last_error,
    }


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