"""Real TeraBox API client — login, quota, list and upload via aioterabox."""
from __future__ import annotations

import asyncio
import logging
import os
import threading
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

from backend.domains.deployment.appliance_cloud_config import (
    has_terabox_session_cookies,
    persist_terabox_session_cookies,
    resolve_terabox_credentials,
    resolve_terabox_session_cookies,
    resolve_terabox_settings,
)

LOGGER = logging.getLogger(__name__)

_CACHE: Dict[str, Tuple[float, Any]] = {}
_CACHE_TTL_SEC = int(os.environ.get("TERABOX_CACHE_TTL_SEC", "180"))
_TERABOX_LOCK = threading.Lock()

VERIFY_HELP = (
    "TeraBox pide verificación humana (need verify). Abra terabox.com en el navegador, "
    "inicie sesión, luego en F12 → Application → Cookies copie ndus, jstoken, csrfToken "
    "y browserid, y pégalos en «Sesión del navegador» del panel ERP."
)


def clear_terabox_cache() -> None:
    _CACHE.clear()


def get_cached_connection_status() -> Optional[Dict[str, Any]]:
    return _cache_get("connection")


def _cache_get(key: str) -> Optional[Any]:
    row = _CACHE.get(key)
    if not row:
        return None
    ts, value = row
    if time.time() - ts > _CACHE_TTL_SEC:
        return None
    return value


def _cache_set(key: str, value: Any) -> None:
    _CACHE[key] = (time.time(), value)


def _run_async(coro):
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import concurrent.futures

            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                return pool.submit(lambda: asyncio.run(coro)).result()
        return loop.run_until_complete(coro)
    except RuntimeError:
        return asyncio.run(coro)


def _format_error(exc: Exception) -> str:
    if isinstance(exc, KeyError):
        return VERIFY_HELP
    text = str(exc).strip() or exc.__class__.__name__
    lowered = text.lower()
    if (
        "need verify" in lowered
        or "simple-verify" in lowered
        or "login requires" in lowered
        or "errmsg" in lowered
        or "challenge" in lowered
    ):
        return VERIFY_HELP
    if not has_terabox_session_cookies() and resolve_terabox_credentials()[1]:
        return f"{VERIFY_HELP} (login automático bloqueado)"
    return text


@asynccontextmanager
async def _terabox_client():
    import aiohttp
    from aioterabox.api import TeraboxClient
    from aioterabox.exceptions import TeraboxLoginChallengeRequired, TeraboxUnauthorizedError

    username, password = resolve_terabox_credentials()
    if not username:
        raise ValueError("Credenciales TeraBox no configuradas")

    cookies = resolve_terabox_session_cookies()
    use_cookies = has_terabox_session_cookies()

    session = aiohttp.ClientSession()
    client = TeraboxClient(
        email=username,
        password=password or "",
        session=session,
        cookies=cookies if use_cookies else None,
    )
    try:
        if use_cookies:
            await client.ensure_logged_in()
        elif password:
            try:
                await client.login()
            except TeraboxLoginChallengeRequired as exc:
                raise ValueError(VERIFY_HELP) from exc
            except TeraboxUnauthorizedError as exc:
                if "need verify" in str(exc).lower() or "simple-verify" in str(exc).lower():
                    raise ValueError(VERIFY_HELP) from exc
                raise
            except KeyError as exc:
                raise ValueError(VERIFY_HELP) from exc
        else:
            raise ValueError("Configure contraseña o cookies de sesión TeraBox")

        persist_terabox_session_cookies(client.request_cookies)
        yield client
    finally:
        if not session.closed:
            await session.close()
        await asyncio.sleep(0.05)


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
    async with _terabox_client() as client:
        await client.ensure_logged_in()
        quota = await client.get_storage_quota()
        return {
            "connected": True,
            "message": "Sesión TeraBox activa",
            "username": username,
            "remote_used_bytes": int(quota.get("used") or 0),
            "remote_total_bytes": int(quota.get("total") or 0),
            "session_mode": "cookies" if has_terabox_session_cookies() else "password",
            "tested_at": datetime.now(timezone.utc).isoformat(),
        }


async def get_quota_async() -> Dict[str, Any]:
    async with _terabox_client() as client:
        await client.ensure_logged_in()
        return await client.get_storage_quota()


async def list_directory_async(remote_path: Optional[str] = None) -> Dict[str, Any]:
    settings = resolve_terabox_settings()
    directory = "/" + str(remote_path or settings.get("root_folder") or "/MCLarensERP").strip("/")

    async with _terabox_client() as client:
        await client.ensure_logged_in()
        entries = await client.list_remote_directory(directory)
        return {
            "connected": True,
            "path": directory,
            "entries": [_entry_row(item) for item in entries],
            "message": "Listado remoto TeraBox",
            "source": "remote",
        }


async def upload_file_async(local_path: str, remote_path: str) -> Dict[str, Any]:
    archive = Path(local_path)
    if not archive.exists():
        raise FileNotFoundError(f"Archivo no encontrado: {archive}")

    destination = "/" + str(remote_path).strip("/")
    async with _terabox_client() as client:
        await client.ensure_logged_in()
        await _ensure_remote_dirs(client, destination)
        result = await client.upload_file(str(archive), destination)
        return {
            "ok": True,
            "remote_path": destination,
            "fs_id": result.get("fs_id"),
            "message": f"Subido a TeraBox: {destination}",
        }


def _cached_call(key: str, coro_factory, *, force: bool = False) -> Any:
    if not force:
        cached = _cache_get(key)
        if cached is not None:
            return cached
    with _TERABOX_LOCK:
        if not force:
            cached = _cache_get(key)
            if cached is not None:
                return cached
        result = _run_async(coro_factory())
        _cache_set(key, result)
        return result


def test_connection(*, force: bool = False) -> Dict[str, Any]:
    try:
        return _cached_call("connection", test_connection_async, force=force)
    except Exception as exc:
        username, _ = resolve_terabox_credentials()
        return {
            "connected": False,
            "message": _format_error(exc),
            "username": username,
            "needs_browser_session": not has_terabox_session_cookies(),
            "tested_at": datetime.now(timezone.utc).isoformat(),
        }


def list_directory(remote_path: Optional[str] = None, *, force: bool = False) -> Dict[str, Any]:
    settings = resolve_terabox_settings()
    directory = "/" + str(remote_path or settings.get("root_folder") or "/MCLarensERP").strip("/")
    cache_key = f"list:{directory}"
    try:
        if not force:
            cached = _cache_get(cache_key)
            if cached is not None:
                return cached
        with _TERABOX_LOCK:
            if not force:
                cached = _cache_get(cache_key)
                if cached is not None:
                    return cached
            result = _run_async(list_directory_async(directory))
            _cache_set(cache_key, result)
            return result
    except Exception as exc:
        return {
            "connected": False,
            "path": directory,
            "entries": [],
            "message": _format_error(exc),
            "source": "error",
            "remote_error": _format_error(exc),
            "needs_browser_session": not has_terabox_session_cookies(),
        }


def upload_file(local_path: str, remote_path: str) -> Dict[str, Any]:
    result = _run_async(upload_file_async(local_path, remote_path))
    clear_terabox_cache()
    parent = str(Path(remote_path).parent).replace("\\", "/")
    _CACHE.pop(f"list:{parent}", None)
    return result


def get_quota(*, force: bool = False) -> Dict[str, Any]:
    return _cached_call("quota", get_quota_async, force=force)