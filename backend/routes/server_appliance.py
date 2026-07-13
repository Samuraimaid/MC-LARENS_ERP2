from __future__ import annotations

import os
import shutil
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

import httpx
from fastapi import APIRouter, Request

from backend.db.distributed import ping_central_database, resolve_central_mongo_uri
from backend.domains.deployment.node_profile import build_node_profile
from backend.services.hardware_monitor import get_active_alerts, get_last_scan_at, scan_hardware_health


def _read_cpu_percent() -> Optional[float]:
    try:
        import psutil  # type: ignore

        return float(psutil.cpu_percent(interval=0.2))
    except Exception:
        load = os.getloadavg()[0] if hasattr(os, "getloadavg") else None
        if load is None:
            return None
        cpus = os.cpu_count() or 1
        return min(100.0, round((load / cpus) * 100.0, 1))


def _read_memory_metrics() -> Dict[str, Any]:
    try:
        import psutil  # type: ignore

        vm = psutil.virtual_memory()
        return {
            "percent": round(float(vm.percent), 1),
            "used_bytes": int(vm.used),
            "total_bytes": int(vm.total),
        }
    except Exception:
        return {"percent": None, "used_bytes": None, "total_bytes": None}


def _read_temperature_c() -> Optional[float]:
    try:
        import psutil  # type: ignore

        temps = getattr(psutil, "sensors_temperatures", lambda: {})()
        for entries in temps.values():
            for entry in entries:
                current = getattr(entry, "current", None)
                if current is not None:
                    return round(float(current), 1)
    except Exception:
        pass
    thermal = Path("/sys/class/thermal/thermal_zone0/temp")
    if thermal.exists():
        try:
            return round(int(thermal.read_text().strip()) / 1000.0, 1)
        except Exception:
            return None
    return None


def _disk_usage(path: str) -> Dict[str, Any]:
    try:
        usage = shutil.disk_usage(path)
        return {
            "path": path,
            "total_bytes": usage.total,
            "used_bytes": usage.used,
            "free_bytes": usage.free,
            "percent": round((usage.used / usage.total) * 100, 1) if usage.total else None,
        }
    except Exception:
        return {"path": path, "total_bytes": None, "used_bytes": None, "free_bytes": None, "percent": None}


async def _count_active_users(db) -> int:
    now_iso = datetime.now(timezone.utc).isoformat()
    try:
        return await db.sessions.count_documents({"expires_at": {"$gte": now_iso}})
    except Exception:
        try:
            return await db.sessions.count_documents({})
        except Exception:
            return 0


async def _tunnel_health() -> Dict[str, Any]:
    tunnel_url = (
        os.environ.get("PUBLIC_TUNNEL_URL")
        or os.environ.get("PUBLIC_TUNNEL_URL_MAIN")
        or "https://mclarenerp.com"
    ).rstrip("/")
    started = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=4.0, follow_redirects=True) as client:
            response = await client.get(f"{tunnel_url}/api/currencies/usd-nio-dual")
            elapsed_ms = round((time.perf_counter() - started) * 1000, 1)
            healthy = 200 <= response.status_code < 500
            return {
                "url": tunnel_url,
                "healthy": healthy,
                "status_code": response.status_code,
                "latency_ms": elapsed_ms,
            }
    except Exception as exc:
        return {
            "url": tunnel_url,
            "healthy": False,
            "status_code": None,
            "latency_ms": None,
            "detail": str(exc),
        }


def get_server_appliance_router(db, require_auth=None, require_roles=None):
    router = APIRouter()
    ADMIN_ROLES = ["gerencia", "programador"]

    @router.get("/server-appliance/profile")
    async def server_appliance_profile():
        profile = build_node_profile()
        lan_ip = profile.get("lan_ip") or "192.168.1.26"
        port = profile.get("frontend_port") or 3000
        return {
            **profile,
            "access_url": f"http://{lan_ip}:{port}",
            "dashboard_url": f"http://{lan_ip}:{port}/server-dashboard",
            "qr_target_url": f"http://{lan_ip}:{port}",
        }

    @router.get("/server-appliance/dashboard")
    async def server_appliance_dashboard():
        profile = build_node_profile()
        lan_ip = profile.get("lan_ip") or "192.168.1.26"
        port = profile.get("frontend_port") or 3000
        uploads_path = os.environ.get("LOCAL_UPLOAD_ROOT", "/app/uploads")
        usb_path = os.environ.get("USB_BACKUP_ROOT", "/mnt/usb_backup")

        local_db_ok = True
        try:
            await db.command("ping")
        except Exception:
            local_db_ok = False

        central_enabled = bool(resolve_central_mongo_uri())
        central_ok = await ping_central_database() if central_enabled else None

        atlas_stats: Dict[str, Any] = {"enabled": central_enabled, "healthy": central_ok}
        if central_ok:
            try:
                from backend.db.distributed import get_central_database

                central_db = get_central_database()
                if central_db is not None:
                    stats = await central_db.command("dbStats")
                    used = int(stats.get("storageSize") or 0) + int(stats.get("indexSize") or 0)
                    free_limit = int(os.environ.get("MONGODB_ATLAS_FREE_BYTES", str(512 * 1024 * 1024)))
                    atlas_stats.update({
                        "used_bytes": used,
                        "free_limit_bytes": free_limit,
                        "percent": round((used / free_limit) * 100, 1) if free_limit else None,
                    })
            except Exception:
                pass

        terabox_status: Dict[str, Any] = {"indicator": "Sin datos TeraBox"}
        emergency_status: Dict[str, Any] = {"active": False}
        try:
            from backend.services.terabox_backup_service import format_terabox_indicator, read_terabox_status

            terabox_raw = read_terabox_status()
            terabox_status = {**terabox_raw, "indicator": format_terabox_indicator(terabox_raw)}
        except Exception:
            pass
        try:
            from backend.middlewares.emergency_standby import resolve_emergency_host_for

            host_for = resolve_emergency_host_for()
            emergency_status = {
                "active": bool(host_for),
                "emergency_host_for": host_for,
                "public_url": os.environ.get("PUBLIC_TUNNEL_URL_MAIN", "https://mclarenerp.com"),
            }
        except Exception:
            pass

        return {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "node": profile,
            "access": {
                "lan_ip": lan_ip,
                "frontend_port": port,
                "url": f"http://{lan_ip}:{port}",
                "dashboard_url": f"http://{lan_ip}:{port}/server-dashboard",
            },
            "metrics": {
                "cpu_percent": _read_cpu_percent(),
                "memory": _read_memory_metrics(),
                "temperature_c": _read_temperature_c(),
                "active_users": await _count_active_users(db),
                "disk_uploads": _disk_usage(uploads_path),
                "disk_usb": _disk_usage(usb_path),
            },
            "delta": {
                "local_database": {"healthy": local_db_ok},
                "cloudflare_tunnel": await _tunnel_health(),
                "mongodb_atlas": atlas_stats,
                "hardware_alerts": get_active_alerts(),
                "last_hardware_scan": get_last_scan_at(),
                "terabox": terabox_status,
                "emergency_standby": emergency_status,
            },
        }

    @router.get("/server-appliance/terabox/overview")
    async def terabox_cloud_overview(request: Request):
        if require_roles:
            await require_roles(request, ADMIN_ROLES)
        elif require_auth:
            await require_auth(request)
        from backend.services.terabox_overview_service import build_terabox_overview

        return build_terabox_overview()

    @router.get("/server-appliance/alerts")
    async def server_appliance_alerts():
        return {
            "alerts": get_active_alerts(),
            "alert_count": len(get_active_alerts()),
            "last_scan": get_last_scan_at(),
            "beep_required": any(item.get("severity") == "critical" for item in get_active_alerts()),
        }

    @router.post("/server-appliance/alerts/scan")
    async def server_appliance_alerts_scan():
        return await scan_hardware_health(db)

    @router.post("/server-appliance/alerts/ack-beep")
    async def server_appliance_ack_beep(request: Request):
        flag = Path(os.environ.get("HARDWARE_BEEP_FLAG_PATH", "/app/backend/data/hardware_beep.flag"))
        if flag.exists():
            flag.unlink(missing_ok=True)
        return {"acknowledged": True, "cleared_flag": str(flag)}

    return router