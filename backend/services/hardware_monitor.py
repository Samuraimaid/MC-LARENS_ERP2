from __future__ import annotations

import asyncio
import logging
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx

from backend.db.distributed import ping_central_database

logger = logging.getLogger("erp.hardware_monitor")

POLL_SECONDS = int(os.environ.get("HARDWARE_MONITOR_INTERVAL_SEC", "30"))
USB_ROOT = Path(os.environ.get("USB_BACKUP_ROOT", "/mnt/usb_backup"))
BEEP_FLAG_PATH = Path(os.environ.get("HARDWARE_BEEP_FLAG_PATH", "/app/backend/data/hardware_beep.flag"))
INTERNET_PROBE_URL = os.environ.get("HARDWARE_INTERNET_PROBE_URL", "https://1.1.1.1/cdn-cgi/trace")
ATLAS_FREE_BYTES = int(os.environ.get("MONGODB_ATLAS_FREE_BYTES", str(512 * 1024 * 1024)))

_active_alerts: List[Dict[str, Any]] = []
_last_scan_at: Optional[str] = None


def get_active_alerts() -> List[Dict[str, Any]]:
    return list(_active_alerts)


def get_last_scan_at() -> Optional[str]:
    return _last_scan_at


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _trigger_host_beep(reason: str) -> None:
    try:
        BEEP_FLAG_PATH.parent.mkdir(parents=True, exist_ok=True)
        BEEP_FLAG_PATH.write_text(f"{_now_iso()}|{reason}\n", encoding="utf-8")
    except Exception:
        logger.exception("Failed writing hardware beep flag")


async def _check_local_database(db) -> Optional[Dict[str, Any]]:
    try:
        await db.command("ping")
        return None
    except Exception as exc:
        return {
            "code": "database_corrupt",
            "severity": "critical",
            "message": "Base de datos local no responde o está corrupta",
            "detail": str(exc),
        }


async def _check_internet() -> Optional[Dict[str, Any]]:
    try:
        async with httpx.AsyncClient(timeout=4.0, follow_redirects=True) as client:
            response = await client.get(INTERNET_PROBE_URL)
            if response.status_code < 500:
                return None
    except Exception as exc:
        return {
            "code": "internet_down",
            "severity": "warning",
            "message": "Conexión a Internet caída en la sucursal",
            "detail": str(exc),
        }
    return {
        "code": "internet_down",
        "severity": "warning",
        "message": "Conexión a Internet degradada",
        "detail": f"HTTP {response.status_code}",
    }


def _check_usb_backup() -> Optional[Dict[str, Any]]:
    if not USB_ROOT.exists():
        return {
            "code": "usb_disconnected",
            "severity": "critical",
            "message": "Disco USB de respaldos desconectado físicamente",
            "detail": str(USB_ROOT),
        }
    archives = list(USB_ROOT.glob("erp_delta_backup_*.tar.gz"))
    if not archives:
        return {
            "code": "usb_empty",
            "severity": "warning",
            "message": "USB montado pero sin respaldos Delta recientes",
            "detail": str(USB_ROOT),
        }
    return None


async def _estimate_atlas_usage_bytes(_db) -> Optional[int]:
    central_ok = await ping_central_database()
    if not central_ok:
        return None
    try:
        from backend.db.distributed import get_central_database

        central_db = get_central_database()
        if central_db is None:
            return None
        stats = await central_db.command("dbStats")
        storage = int(stats.get("storageSize") or stats.get("dataSize") or 0)
        index_size = int(stats.get("indexSize") or 0)
        return storage + index_size
    except Exception:
        logger.exception("Failed reading Atlas dbStats")
        return None


async def scan_hardware_health(db) -> Dict[str, Any]:
    global _active_alerts, _last_scan_at

    alerts: List[Dict[str, Any]] = []
    for check in (
        await _check_local_database(db),
        await _check_internet(),
        _check_usb_backup(),
    ):
        if check:
            alerts.append({**check, "detected_at": _now_iso()})

    atlas_used = await _estimate_atlas_usage_bytes(db)
    if atlas_used is not None and atlas_used >= int(ATLAS_FREE_BYTES * 0.9):
        alerts.append({
            "code": "atlas_quota_high",
            "severity": "warning",
            "message": "MongoDB Atlas cerca del límite gratuito de 512 MB",
            "detail": f"{atlas_used} bytes usados",
            "detected_at": _now_iso(),
        })

    previous_codes = {item.get("code") for item in _active_alerts}
    new_codes = {item.get("code") for item in alerts}
    critical_new = [item for item in alerts if item.get("severity") == "critical" and item.get("code") not in previous_codes]

    _active_alerts = alerts
    _last_scan_at = _now_iso()

    for alert in critical_new:
        _trigger_host_beep(str(alert.get("code") or "hardware_alert"))

    return {
        "alerts": alerts,
        "alert_count": len(alerts),
        "scanned_at": _last_scan_at,
        "beep_flag_path": str(BEEP_FLAG_PATH),
    }


async def hardware_monitor_loop(db) -> None:
    logger.info("Hardware monitor loop started (interval=%ss)", POLL_SECONDS)
    while True:
        try:
            await scan_hardware_health(db)
        except Exception:
            logger.exception("Hardware monitor scan failed")
        await asyncio.sleep(POLL_SECONDS)


def start_hardware_monitor(db) -> asyncio.Task:
    return asyncio.create_task(hardware_monitor_loop(db))