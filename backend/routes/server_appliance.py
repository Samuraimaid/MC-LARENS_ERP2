from __future__ import annotations

import asyncio
import os
import shutil
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

import httpx
from fastapi import APIRouter, HTTPException, Request

from backend.db.distributed import ping_central_database, resolve_central_mongo_uri
from backend.domains.deployment.lan_identity import resolve_lan_ip
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
        lan_ip, lan_ip_source = resolve_lan_ip()
        port = profile.get("frontend_port") or 3000
        return {
            **profile,
            "lan_ip": lan_ip,
            "lan_ip_source": lan_ip_source,
            "access_url": f"http://{lan_ip}:{port}",
            "dashboard_url": f"http://{lan_ip}:{port}/server-dashboard",
            "qr_target_url": f"http://{lan_ip}:{port}",
        }

    @router.get("/server-appliance/dashboard")
    async def server_appliance_dashboard():
        from backend.services.hypervisor_telemetry import build_hypervisor_dashboard

        payload = await build_hypervisor_dashboard(db)
        hw = payload.get("hardware") or {}
        lan = payload.get("local_lan") or {}
        cloud = payload.get("cloud_services") or {}
        uploads_path = os.environ.get("LOCAL_UPLOAD_ROOT", "/app/uploads")
        usb_path = os.environ.get("USB_BACKUP_ROOT", "/mnt/usb_backup")

        local_db_ok = True
        try:
            await db.command("ping")
        except Exception:
            local_db_ok = False

        atlas = cloud.get("mongodb_atlas") or {}
        terabox = cloud.get("terabox") or {}
        cf = cloud.get("cloudflare") or {}
        emergency_status: Dict[str, Any] = {"active": False}
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

        payload["metrics"] = {
            "cpu_percent": hw.get("cpu_usage_pct"),
            "memory": {
                "percent": hw.get("ram_usage_pct"),
                "used_bytes": int((hw.get("ram_used_gb") or 0) * 1024 ** 3),
                "total_bytes": int((hw.get("ram_total_gb") or 0) * 1024 ** 3),
            },
            "temperature_c": hw.get("cpu_temp_c"),
            "battery_pct": hw.get("battery_pct"),
            "battery_status": hw.get("battery_status"),
            "active_users": lan.get("active_users_count"),
            "disk_uploads": _disk_usage(uploads_path),
            "disk_usb": _disk_usage(usb_path),
            "uptime_hours": hw.get("uptime_hours"),
        }
        payload["delta"] = {
            "local_database": {"healthy": local_db_ok},
            "cloudflare_tunnel": {
                "healthy": cf.get("tunnel_status") == "ONLINE",
                "latency_ms": cf.get("latency_ms"),
                "url": cf.get("url"),
            },
            "mongodb_atlas": {
                "enabled": atlas.get("status") != "DISABLED",
                "healthy": atlas.get("status") == "CONNECTED",
                "percent": atlas.get("used_pct"),
                "used_bytes": int((atlas.get("size_used_mb") or 0) * 1024 ** 2),
                "free_limit_bytes": int((atlas.get("size_total_mb") or 512) * 1024 ** 2),
            },
            "hardware_alerts": get_active_alerts(),
            "last_hardware_scan": get_last_scan_at(),
            "terabox": terabox,
            "emergency_standby": emergency_status,
        }
        return payload

    @router.get("/server-appliance/terabox/overview")
    async def terabox_cloud_overview(request: Request):
        if require_roles:
            await require_roles(request, ADMIN_ROLES)
        elif require_auth:
            await require_auth(request)
        from backend.services.terabox_overview_service import build_terabox_overview

        return build_terabox_overview()

    @router.get("/server-appliance/terabox/credentials")
    async def get_terabox_credentials(request: Request):
        if require_roles:
            await require_roles(request, ADMIN_ROLES)
        elif require_auth:
            await require_auth(request)
        from backend.domains.deployment.appliance_cloud_config import get_terabox_credentials_public
        from backend.services.terabox_client import test_terabox_connection

        public = get_terabox_credentials_public()
        probe = test_terabox_connection()
        return {**public, "connected": probe.get("connected"), "message": probe.get("message")}

    @router.put("/server-appliance/terabox/credentials")
    async def update_terabox_credentials(request: Request, payload: Dict[str, Any]):
        if require_roles:
            await require_roles(request, ADMIN_ROLES)
        elif require_auth:
            await require_auth(request)
        from backend.domains.deployment.appliance_cloud_config import write_appliance_cloud_values
        from backend.services.terabox_client import test_terabox_connection

        from backend.domains.deployment.appliance_cloud_config import resolve_terabox_credentials

        data = payload or {}
        existing_user, _existing_pass = resolve_terabox_credentials()
        username = str(data.get("username") or data.get("TERABOX_USERNAME") or existing_user or "").strip()
        password = str(data.get("password") or data.get("TERABOX_PASSWORD") or "").strip()
        if not username:
            raise HTTPException(status_code=400, detail="username requerido")
        updates: Dict[str, str] = {"TERABOX_USERNAME": username}
        if password:
            updates["TERABOX_PASSWORD"] = password
        if data.get("root_folder") or data.get("TERABOX_ROOT_FOLDER"):
            updates["TERABOX_ROOT_FOLDER"] = str(data.get("root_folder") or data.get("TERABOX_ROOT_FOLDER")).strip()
        if data.get("remote_folder") or data.get("TERABOX_REMOTE_FOLDER"):
            updates["TERABOX_REMOTE_FOLDER"] = str(data.get("remote_folder") or data.get("TERABOX_REMOTE_FOLDER")).strip()
        if data.get("share_url") or data.get("TERABOX_SHARE_URL"):
            updates["TERABOX_SHARE_URL"] = str(data.get("share_url") or data.get("TERABOX_SHARE_URL")).strip()

        write_appliance_cloud_values(updates)
        probe = test_terabox_connection(username=username, password=password or None)
        if password and not probe.get("connected"):
            raise HTTPException(status_code=400, detail=probe.get("message") or "No se pudo validar TeraBox")
        return {
            "message": "Credenciales TeraBox actualizadas",
            "connected": probe.get("connected"),
            "username_masked": username[:2] + "***@" + username.split("@")[-1] if "@" in username else "***",
        }

    @router.post("/server-appliance/terabox/credentials/test")
    async def test_terabox_credentials_endpoint(request: Request, payload: Optional[Dict[str, Any]] = None):
        if require_roles:
            await require_roles(request, ADMIN_ROLES)
        elif require_auth:
            await require_auth(request)
        from backend.services.terabox_client import test_terabox_connection

        data = payload or {}
        return test_terabox_connection(
            username=str(data.get("username") or "").strip() or None,
            password=str(data.get("password") or "").strip() or None,
        )

    @router.get("/server-appliance/terabox/files")
    async def list_terabox_files(request: Request, path: Optional[str] = None):
        if require_roles:
            await require_roles(request, ADMIN_ROLES)
        elif require_auth:
            await require_auth(request)
        from backend.services.terabox_client import list_terabox_directory

        return list_terabox_directory(path)

    @router.post("/server-appliance/backup/run")
    async def run_full_erp_backup(request: Request):
        if require_roles:
            await require_roles(request, ADMIN_ROLES)
        elif require_auth:
            await require_auth(request)

        script = Path("/app/backend/scripts/backup_server_node.sh")
        if not script.exists():
            script = Path(__file__).resolve().parents[1] / "scripts" / "backup_server_node.sh"
        if not script.exists():
            raise HTTPException(status_code=500, detail="Script de respaldo no encontrado")

        def _run_backup() -> Dict[str, Any]:
            result = subprocess.run(
                ["bash", str(script)],
                capture_output=True,
                text=True,
                timeout=900,
            )
            return {
                "exit_code": result.returncode,
                "stdout": result.stdout[-4000:],
                "stderr": result.stderr[-2000:],
            }

        outcome = await asyncio.to_thread(_run_backup)
        backup_root = Path(os.environ.get("BACKUP_INTERNAL_ROOT", "/app/backups"))
        archives = sorted(backup_root.glob("erp_delta_backup_*.tar.gz"), key=lambda p: p.stat().st_mtime, reverse=True)
        latest = archives[0] if archives else None
        if outcome.get("exit_code") != 0:
            raise HTTPException(
                status_code=500,
                detail={
                    "message": "Respaldo falló",
                    "stderr": outcome.get("stderr"),
                    "stdout": outcome.get("stdout"),
                },
            )
        return {
            "message": "Respaldo completo del ERP iniciado/finalizado",
            "latest_archive": latest.name if latest else None,
            "latest_size_bytes": latest.stat().st_size if latest else None,
            "stdout": outcome.get("stdout"),
        }

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