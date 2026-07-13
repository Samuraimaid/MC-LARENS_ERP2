"""Real TeraBox API client — login, quota, list and upload via aioterabox."""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from backend.domains.deployment.appliance_cloud_config import (
    resolve_terabox_credentials,
    resolve_terabox_settings,
)

LOGGER = logging.getLogger(__name__)


def _run_async(coro):
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import concurrent.futures

            with concurrent.futures.ThreadPoolExecutor() as pool:
                return pool.submit(lambda: asyncio.run(coro)).result()
        return loop.run_until_complete(coro)
    except RuntimeError:
        return asyncio.run(coro)


async def _open_client() -> Tuple[Any, Any]:
    import aiohttp
    from aioterabox.api import TeraboxClient
    from aioterabox.exceptions import TeraboxLoginChallengeRequired

    username, password = resolve_terabox_credentials()
    if not username or not password:
        raise ValueError("Credenciales TeraBox no configuradas")

    session = aiohttp.ClientSession()
    client = TeraboxClient(email=username, password=password, session=session)
    try:
        await client.login()
    except TeraboxLoginChallengeRequired as exc:
        await client.complete_login_challenge(exc.challenge)
    return client, session


async def _close_client(session) -> None:
    if session and not session.closed:
        await session.close()


async def _ensure_remote_dirs(client, remote_path: str) -> None:
    from aioterabox.exceptions import TeraboxApiError, TeraboxNotFoundError

    normalized = "/" + str(remote_path or "/").strip("/")
    parent = str(Path(normalized).parent).replace("\\", "/") or "/"
    if parent == normalized:
        return

    parts = [p for p in parent.split("/") if p]
    acc = ""
    for part in parts:
        acc += f"/{part}"
        try:
            await client.list_remote_directory(acc)
        except TeraboxNotFoundError:
            try:
                await client.create_directory(acc)
            except TeraboxApiError as exc:
                LOGGER.warning("No se pudo crear carpeta %s: %s", acc, exc)


def _entry_row(entry) -> Dict[str, Any]:
    return {
        "name": entry.name,
        "path": entry.path,
        "is_dir": bool(entry.is_dir),
        "size_bytes": int(entry.size or 0),
        "modified_at": None,
        "source": "remote",
    }


async def test_connection_async() -> Dict[str, Any]:
    username, _password = resolve_terabox_credentials()
    client, session = await _open_client()
    try:
        await client.ensure_logged_in()
        quota = await client.get_storage_quota()
        return {
            "connected": True,
            "message": "Sesión TeraBox activa (API real)",
            "username": username,
            "remote_used_bytes": int(quota.get("used") or 0),
            "remote_total_bytes": int(quota.get("total") or 0),
            "tested_at": datetime.now(timezone.utc).isoformat(),
        }
    finally:
        await _close_client(session)


async def get_quota_async() -> Dict[str, Any]:
    client, session = await _open_client()
    try:
        await client.ensure_logged_in()
        return await client.get_storage_quota()
    finally:
        await _close_client(session)


async def list_directory_async(remote_path: Optional[str] = None) -> Dict[str, Any]:
    settings = resolve_terabox_settings()
    directory = "/" + str(remote_path or settings.get("root_folder") or "/MCLarensERP").strip("/")

    client, session = await _open_client()
    try:
        await client.ensure_logged_in()
        entries = await client.list_remote_directory(directory)
        return {
            "connected": True,
            "path": directory,
            "entries": [_entry_row(item) for item in entries],
            "message": "Listado remoto TeraBox",
            "source": "remote",
        }
    finally:
        await _close_client(session)


async def upload_file_async(local_path: str, remote_path: str) -> Dict[str, Any]:
    archive = Path(local_path)
    if not archive.exists():
        raise FileNotFoundError(f"Archivo no encontrado: {archive}")

    destination = "/" + str(remote_path).strip("/")
    client, session = await _open_client()
    try:
        await client.ensure_logged_in()
        await _ensure_remote_dirs(client, destination)
        result = await client.upload_file(str(archive), destination)
        return {
            "ok": True,
            "remote_path": destination,
            "fs_id": result.get("fs_id"),
            "message": f"Subido a TeraBox: {destination}",
        }
    finally:
        await _close_client(session)


def test_connection() -> Dict[str, Any]:
    try:
        return _run_async(test_connection_async())
    except Exception as exc:
        username, _ = resolve_terabox_credentials()
        return {
            "connected": False,
            "message": f"Error TeraBox: {exc}",
            "username": username,
            "tested_at": datetime.now(timezone.utc).isoformat(),
        }


def list_directory(remote_path: Optional[str] = None) -> Dict[str, Any]:
    try:
        return _run_async(list_directory_async(remote_path))
    except Exception as exc:
        settings = resolve_terabox_settings()
        directory = "/" + str(remote_path or settings.get("root_folder") or "/MCLarensERP").strip("/")
        return {
            "connected": False,
            "path": directory,
            "entries": [],
            "message": f"No se pudo listar TeraBox remoto: {exc}",
            "source": "error",
            "remote_error": str(exc),
        }


def upload_file(local_path: str, remote_path: str) -> Dict[str, Any]:
    return _run_async(upload_file_async(local_path, remote_path))


def get_quota() -> Dict[str, Any]:
    return _run_async(get_quota_async())