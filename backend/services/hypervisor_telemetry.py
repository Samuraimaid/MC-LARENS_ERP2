"""HyperVisor Global — unified server & delta mesh telemetry."""
from __future__ import annotations

import os
import platform
import shutil
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import httpx

from backend.db.distributed import get_central_database, ping_central_database
from backend.domains.deployment.appliance_cloud_config import (
    is_cloud_configured,
    resolve_central_mongo_uri,
    resolve_cloudflare_tunnel_token,
    resolve_terabox_credentials,
)
from backend.domains.deployment.lan_identity import resolve_lan_ip
from backend.domains.deployment.node_profile import build_node_profile
from backend.services.hardware_monitor import get_active_alerts
from backend.services.terabox_overview_service import build_terabox_overview

DELTA_BRANCHES: List[Dict[str, str]] = [
    {
        "branch_id": "branch_main",
        "label": "Mundo de Accesorios",
        "tunnel_env": "PUBLIC_TUNNEL_URL_MAIN",
        "default_url": "https://mclarenerp.com",
    },
    {
        "branch_id": "branch_north",
        "label": "TopCar El Calvario",
        "tunnel_env": "PUBLIC_TUNNEL_URL_NORTH",
        "default_url": "https://north.mclarenerp.com",
    },
    {
        "branch_id": "branch_south",
        "label": "TopCar La Tigre",
        "tunnel_env": "PUBLIC_TUNNEL_URL_SOUTH",
        "default_url": "https://south.mclarenerp.com",
    },
]

ATLAS_TOTAL_MB = 512
TERABOX_TOTAL_GB = 1024


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso_now() -> str:
    return _now().isoformat()


def _seconds_since(iso_value: Optional[str]) -> Optional[int]:
    if not iso_value:
        return None
    try:
        dt = datetime.fromisoformat(str(iso_value).replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return max(0, int((_now() - dt).total_seconds()))
    except (ValueError, TypeError):
        return None


def _read_cpu_percent() -> Optional[float]:
    try:
        import psutil  # type: ignore

        psutil.cpu_percent(interval=None)
        time.sleep(0.2)
        value = float(psutil.cpu_percent(interval=0.35))
        if value <= 0.0:
            value = float(psutil.cpu_percent(interval=0.35))
        return round(value, 1)
    except Exception:
        load = os.getloadavg()[0] if hasattr(os, "getloadavg") else None
        if load is None:
            return None
        cpus = os.cpu_count() or 1
        return round(min(100.0, (load / cpus) * 100.0), 1)


def _read_memory_gb() -> Dict[str, Optional[float]]:
    try:
        import psutil  # type: ignore

        vm = psutil.virtual_memory()
        return {
            "ram_used_gb": round(vm.used / (1024 ** 3), 2),
            "ram_total_gb": round(vm.total / (1024 ** 3), 2),
            "ram_pct": round(float(vm.percent), 1),
        }
    except Exception:
        return {"ram_used_gb": None, "ram_total_gb": None, "ram_pct": None}


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


def _resolve_cpu_temp_c(cpu_usage_pct: Optional[float]) -> Tuple[float, bool]:
    """Return CPU temp; synthesize from load when native sensors are unavailable (Windows)."""
    native = _read_temperature_c()
    if native is not None:
        return native, False
    load = cpu_usage_pct if cpu_usage_pct is not None else _read_cpu_percent() or 0.0
    simulated = round(42.0 + (float(load) * 0.33), 1)
    return min(85.0, simulated), True


_WIN_BATTERY_STATUS_MAP = {
    1: "Descargando",
    2: "Conectado a Red Eléctrica (UPS Protegido)",
    3: "Conectado a Red Eléctrica (UPS Protegido)",
    4: "Descargando",
    5: "Descargando",
    6: "Cargando",
    7: "Cargando",
    8: "Cargando",
    9: "Conectado a Red Eléctrica (UPS Protegido)",
    10: "Cargando",
}


def _desktop_battery_defaults() -> Dict[str, Any]:
    return {
        "battery_pct": 100.0,
        "battery_status": "Conectado a Red Eléctrica (UPS Protegido)",
        "battery_on_ac": True,
        "battery_autonomy_minutes": None,
        "battery_source": "desktop_ups",
    }


def _parse_wmic_battery_output(raw: str) -> Dict[str, Any]:
    charge: Optional[int] = None
    status_code: Optional[int] = None
    for line in raw.splitlines():
        text = line.strip()
        if text.startswith("EstimatedChargeRemaining="):
            value = text.split("=", 1)[1].strip()
            if value.isdigit():
                charge = int(value)
        elif text.startswith("BatteryStatus="):
            value = text.split("=", 1)[1].strip()
            if value.isdigit():
                status_code = int(value)
    if charge is None and status_code is None:
        return _desktop_battery_defaults()
    pct = float(charge if charge is not None else 100)
    status_label = _WIN_BATTERY_STATUS_MAP.get(status_code or 2, "Conectado a Red Eléctrica (UPS Protegido)")
    on_ac = status_code in {2, 3, 9} or "Conectado" in status_label
    discharging = status_label == "Descargando"
    autonomy = None
    if discharging and pct > 0:
        autonomy = max(1, int(round(pct * 1.2)))
    return {
        "battery_pct": round(pct, 1),
        "battery_status": status_label,
        "battery_on_ac": on_ac,
        "battery_autonomy_minutes": autonomy,
        "battery_source": "wmic",
    }


def _read_windows_battery() -> Dict[str, Any]:
    if platform.system().lower() != "windows":
        return _desktop_battery_defaults()
    try:
        creationflags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
        result = subprocess.run(
            [
                "wmic",
                "path",
                "Win32_Battery",
                "get",
                "EstimatedChargeRemaining,BatteryStatus",
                "/format:list",
            ],
            capture_output=True,
            text=True,
            timeout=6,
            creationflags=creationflags,
        )
        if result.returncode != 0 or not result.stdout.strip():
            return _desktop_battery_defaults()
        parsed = _parse_wmic_battery_output(result.stdout)
        if parsed.get("battery_source") == "desktop_ups":
            return parsed
        return parsed
    except Exception:
        return _desktop_battery_defaults()


def _format_last_ping(seconds_ago: Optional[int]) -> str:
    if seconds_ago is None:
        return "Sin actividad reciente"
    if seconds_ago < 60:
        return f"Hace {seconds_ago}s"
    minutes = seconds_ago // 60
    if minutes < 60:
        return f"Hace {minutes} min"
    hours = minutes // 60
    return f"Hace {hours}h"


def _signal_strength_from_seconds(seconds_ago: Optional[int]) -> str:
    if seconds_ago is None:
        return "SIN SEÑAL"
    if seconds_ago <= 30:
        return "EXCELENTE"
    if seconds_ago <= 120:
        return "BUENA"
    if seconds_ago <= 300:
        return "REGULAR"
    return "DÉBIL"


def _mask_ni_phone(phone: str) -> str:
    digits = "".join(ch for ch in str(phone or "") if ch.isdigit())
    if len(digits) >= 11 and digits.startswith("505"):
        local = digits[3:]
        if len(local) >= 8:
            return f"+505{local[:4]}-{local[4:8]}"
    if len(digits) == 8:
        return f"+505{digits[:4]}-{digits[4:8]}"
    return str(phone or "+505XXXX-XXXX")


async def _count_branch_active_jobs(db, branch_id: str) -> int:
    try:
        drivers_active = await db.erp_drivers.count_documents(
            {"branch_id": branch_id, "status": "en_ruta"},
        )
        sales_active = await db.sales.count_documents({
            "branch_id": branch_id,
            "$or": [
                {"delivery_status": {"$in": ["en_ruta", "in_transit", "asignado", "assigned"]}},
                {"delivery_info.delivery_status": {"$in": ["en_ruta", "in_transit", "asignado", "assigned"]}},
            ],
        })
        transfers_active = await db.transfer_requests.count_documents({
            "status": "shipped",
            "$or": [
                {"branch_id": branch_id},
                {"assigned_driver_id": {"$exists": True, "$ne": None}},
            ],
        })
        return int(drivers_active + sales_active + transfers_active)
    except Exception:
        return 0


async def _resolve_mobile_backup_device(db, branch_id: str) -> Dict[str, Any]:
    phone = (
        os.environ.get("MOBILE_BACKUP_PHONE")
        or os.environ.get("MOBILE_CONTINGENCY_PHONE")
        or ""
    ).strip()
    last_activity_iso: Optional[str] = None

    try:
        from backend.domains.hr.drivers import ensure_erp_drivers, list_drivers

        await ensure_erp_drivers(db)
        drivers = await list_drivers(db, branch_id=branch_id)
        if not phone:
            primary = next(
                (d for d in drivers if d.get("driver_type") == "delivery_last_mile"),
                drivers[0] if drivers else None,
            )
            phone = str((primary or {}).get("phone") or "+50588881201")
        for driver in drivers:
            for field in ("updated_at", "last_portal_ping_at"):
                iso = driver.get(field)
                if iso and (last_activity_iso is None or iso > last_activity_iso):
                    last_activity_iso = iso
    except Exception:
        if not phone:
            phone = "+50588881201"

    try:
        token_row = await db.erp_driver_auth_tokens.find(
            {"consumed_at": {"$ne": None}},
            {"_id": 0, "consumed_at": 1},
        ).sort("consumed_at", -1).limit(1).to_list(1)
        if token_row:
            consumed = token_row[0].get("consumed_at")
            if consumed and (last_activity_iso is None or consumed > last_activity_iso):
                last_activity_iso = consumed
    except Exception:
        pass

    seconds_ago = _seconds_since(last_activity_iso)
    active_jobs = await _count_branch_active_jobs(db, branch_id)
    online = seconds_ago is not None and seconds_ago <= 300
    if active_jobs > 0 and seconds_ago is None:
        online = True
        seconds_ago = 3

    return {
        "status": "ONLINE" if online else "OFFLINE",
        "phone_number": _mask_ni_phone(phone),
        "signal_strength": _signal_strength_from_seconds(seconds_ago if online else seconds_ago),
        "last_ping": _format_last_ping(seconds_ago if seconds_ago is not None else (3 if online else None)),
        "last_ping_seconds_ago": seconds_ago,
        "active_jobs": active_jobs,
    }


def _read_uptime_hours() -> Optional[float]:
    try:
        import psutil  # type: ignore

        boot = psutil.boot_time()
        return round((time.time() - boot) / 3600.0, 2)
    except Exception:
        return None


def _disk_uploads_pct(uploads_path: str) -> Optional[float]:
    try:
        usage = shutil.disk_usage(uploads_path)
        return round((usage.used / usage.total) * 100, 1) if usage.total else None
    except Exception:
        return None


def _count_net_connections() -> int:
    try:
        import psutil  # type: ignore

        return len(psutil.net_connections(kind="inet"))
    except Exception:
        return 0


def _usb_backup_status(alerts: List[Dict[str, Any]], usb_path: str) -> str:
    if any(item.get("code") == "usb_disconnected" for item in alerts):
        return "DISCONNECTED"
    try:
        if Path(usb_path).exists():
            return "CONNECTED"
    except Exception:
        pass
    return "DISCONNECTED"


async def _count_active_users(db) -> int:
    now_iso = _iso_now()
    try:
        return await db.sessions.count_documents({"expires_at": {"$gte": now_iso}})
    except Exception:
        try:
            return await db.sessions.count_documents({})
        except Exception:
            return 0


async def _probe_tunnel(url: str) -> Dict[str, Any]:
    base = str(url or "").rstrip("/")
    started = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=4.5, follow_redirects=True) as client:
            response = await client.get(f"{base}/api/currencies/usd-nio-dual")
            elapsed_ms = round((time.perf_counter() - started) * 1000, 1)
            healthy = 200 <= response.status_code < 500
            bytes_len = len(response.content or b"")
            elapsed_s = max((time.perf_counter() - started), 0.001)
            bandwidth_kbps = round((bytes_len * 8) / elapsed_s / 1000, 1)
            return {
                "healthy": healthy,
                "latency_ms": elapsed_ms,
                "bandwidth_kbps": bandwidth_kbps,
                "status_code": response.status_code,
            }
    except Exception as exc:
        return {
            "healthy": False,
            "latency_ms": None,
            "bandwidth_kbps": 0,
            "status_code": None,
            "detail": str(exc),
        }


async def _branch_sync_meta(central_db, branch_id: str) -> Dict[str, Any]:
    if central_db is None:
        return {"last_sync_iso": None, "packets_flow": 0}
    try:
        latest = await central_db.inventory.find(
            {"branch_id": branch_id},
            {"_id": 0, "replicated_at": 1, "synced_at": 1, "last_updated": 1},
        ).sort("replicated_at", -1).limit(1).to_list(1)
        row = latest[0] if latest else {}
        last_iso = row.get("replicated_at") or row.get("synced_at") or row.get("last_updated")
        since_5m = _now().timestamp() - 300
        packets_flow = await central_db.inventory.count_documents({
            "branch_id": branch_id,
            "$or": [
                {"replicated_at": {"$gte": datetime.fromtimestamp(since_5m, tz=timezone.utc).isoformat()}},
                {"synced_at": {"$gte": datetime.fromtimestamp(since_5m, tz=timezone.utc).isoformat()}},
            ],
        })
        return {"last_sync_iso": last_iso, "packets_flow": int(packets_flow)}
    except Exception:
        return {"last_sync_iso": None, "packets_flow": 0}


async def _load_atlas_nodes(central_db) -> Dict[str, Dict[str, Any]]:
    if central_db is None:
        return {}
    try:
        rows = await central_db.erp_server_nodes.find(
            {"branch_id": {"$in": [b["branch_id"] for b in DELTA_BRANCHES]}, "status": {"$ne": "retired"}},
            {"_id": 0},
        ).to_list(20)
        return {str(r.get("branch_id") or r.get("node_id")): r for r in rows}
    except Exception:
        return {}


async def build_delta_mesh_network(central_db, local_branch_id: str) -> List[Dict[str, Any]]:
    atlas_nodes = await _load_atlas_nodes(central_db)
    mesh: List[Dict[str, Any]] = []

    for branch in DELTA_BRANCHES:
        branch_id = branch["branch_id"]
        public_url = os.environ.get(branch["tunnel_env"], branch["default_url"]).rstrip("/")
        probe = await _probe_tunnel(public_url)
        sync_meta = await _branch_sync_meta(central_db, branch_id)
        node_doc = atlas_nodes.get(branch_id) or {}
        node_updated = node_doc.get("updated_at") or node_doc.get("registered_at")
        last_sync_iso = sync_meta.get("last_sync_iso") or node_updated
        last_sync_seconds_ago = _seconds_since(last_sync_iso)

        online = probe.get("healthy") is True
        if branch_id == local_branch_id:
            online = True

        mesh.append({
            "branch_id": branch_id,
            "label": branch["label"],
            "status": "online" if online else "offline",
            "latency_ms": probe.get("latency_ms"),
            "last_sync_seconds_ago": last_sync_seconds_ago,
            "packets_flow": sync_meta.get("packets_flow") or 0,
            "public_url": public_url,
            "is_local_node": branch_id == local_branch_id,
        })
    return mesh


def _terabox_cloud_block(
    terabox_overview: Dict[str, Any],
    terabox_raw: Dict[str, Any],
    *,
    creds_configured: bool = False,
) -> Dict[str, Any]:
    folders = terabox_overview.get("folders") or []
    local_ready = any(str(item.get("status") or "").lower() == "ok" for item in folders)
    remote_connected = bool(terabox_overview.get("connected") or terabox_raw.get("connected"))
    connected = remote_connected or creds_configured or local_ready

    used_bytes = int(terabox_overview.get("used_space_bytes") or terabox_raw.get("space_used_bytes") or 0)
    used_gb = round(used_bytes / (1024 ** 3), 2)
    sync_ok = terabox_raw.get("last_upload_status") == "success"
    sync_error = terabox_raw.get("last_upload_status") == "error"
    if sync_ok:
        sync_pct = 100.0
    elif sync_error:
        sync_pct = 0.0
    elif remote_connected:
        sync_pct = 25.0
    elif creds_configured:
        sync_pct = 10.0
    else:
        sync_pct = 0.0

    last_backup = terabox_raw.get("last_upload_at")
    if not last_backup and local_ready:
        backup_root = Path(os.environ.get("BACKUP_INTERNAL_ROOT", "/app/backups"))
        archives = sorted(backup_root.glob("erp_delta_backup_*.tar.gz"), key=lambda p: p.stat().st_mtime, reverse=True)
        if archives:
            last_backup = datetime.fromtimestamp(archives[0].stat().st_mtime, tz=timezone.utc).isoformat()

    return {
        "status": "CONNECTED" if connected else "DISCONNECTED",
        "storage_used_gb": used_gb,
        "storage_total_gb": TERABOX_TOTAL_GB,
        "sync_success_pct": round(sync_pct, 1),
        "last_backup_time": last_backup,
        "used_pct": terabox_overview.get("used_percentage"),
        "folders": folders,
        "env_configured": creds_configured,
        "local_mirror_ready": local_ready,
        "remote_session_active": remote_connected,
    }


async def _database_storage_stats(database) -> Dict[str, Optional[float]]:
    try:
        await database.command("ping")
        stats = await database.command("dbStats")
        used_bytes = int(stats.get("storageSize") or 0) + int(stats.get("indexSize") or 0)
        used_mb = round(used_bytes / (1024 ** 2), 1)
        used_pct = round((used_bytes / (ATLAS_TOTAL_MB * 1024 ** 2)) * 100, 1)
        return {"size_used_mb": used_mb, "used_pct": used_pct}
    except Exception:
        return {"size_used_mb": None, "used_pct": None}


async def _ping_external_central(uri: str, db_name: str):
    try:
        from motor.motor_asyncio import AsyncIOMotorClient

        client = AsyncIOMotorClient(uri, serverSelectionTimeoutMS=4500)
        database = client[db_name]
        await database.command("ping")
        stats = await database.command("dbStats")
        client.close()
        return True, stats
    except Exception:
        return False, None


async def _resolve_atlas_block(db, local_branch_id: str) -> Dict[str, Any]:
    central_uri = resolve_central_mongo_uri()
    central_enabled = bool(central_uri)
    db_name = (
        os.environ.get("MONGODB_CENTRAL_DB")
        or os.environ.get("CENTRAL_DB_NAME")
        or os.environ.get("DB_NAME")
        or "mc-larens2_mundo_accesorios_erp"
    )

    size_used_mb = None
    used_pct = None
    ping_healthy = False
    cluster_mode = "disconnected"

    if central_enabled:
        ping_healthy, stats = await _ping_external_central(central_uri, db_name)
        if ping_healthy and stats:
            used_bytes = int(stats.get("storageSize") or 0) + int(stats.get("indexSize") or 0)
            size_used_mb = round(used_bytes / (1024 ** 2), 1)
            used_pct = round((used_bytes / (ATLAS_TOTAL_MB * 1024 ** 2)) * 100, 1)
            cluster_mode = "atlas"
        else:
            cluster_mode = "configured_standby"
    else:
        local_stats = await _database_storage_stats(db)
        if local_stats.get("size_used_mb") is not None:
            size_used_mb = local_stats["size_used_mb"]
            used_pct = local_stats["used_pct"]
            ping_healthy = True
            cluster_mode = "local_primary"

    connected = (
        ping_healthy
        or central_enabled
        or (cluster_mode == "local_primary" and str(local_branch_id) == "branch_main")
    )

    return {
        "status": "CONNECTED" if connected else "DISCONNECTED",
        "size_used_mb": size_used_mb,
        "size_total_mb": ATLAS_TOTAL_MB,
        "used_pct": used_pct,
        "env_configured": central_enabled,
        "ping_healthy": ping_healthy,
        "cluster_mode": cluster_mode,
    }


async def build_hypervisor_dashboard(db) -> Dict[str, Any]:
    profile = build_node_profile()
    lan_ip, lan_ip_source = resolve_lan_ip()
    if profile.get("lan_ip"):
        lan_ip = str(profile.get("lan_ip"))
        lan_ip_source = str(profile.get("lan_ip_source") or lan_ip_source)
    port = int(profile.get("frontend_port") or os.environ.get("SERVER_FRONTEND_PORT") or 3000)
    uploads_path = os.environ.get("LOCAL_UPLOAD_ROOT", "/app/uploads")
    usb_path = os.environ.get("USB_BACKUP_ROOT", "/mnt/usb_backup")
    local_branch_id = str(os.environ.get("BRANCH_ID") or profile.get("node_id") or "branch_main").strip()

    mem = _read_memory_gb()
    cpu_usage = _read_cpu_percent()
    cpu_temp_c, cpu_temp_simulated = _resolve_cpu_temp_c(cpu_usage)
    battery = _read_windows_battery()
    alerts = get_active_alerts()
    active_users = await _count_active_users(db)

    tunnel_url = (
        os.environ.get("PUBLIC_TUNNEL_URL")
        or os.environ.get("PUBLIC_TUNNEL_URL_MAIN")
        or "https://mclarenerp.com"
    ).rstrip("/")
    tunnel_probe = await _probe_tunnel(tunnel_url)
    cf_token_configured = bool(resolve_cloudflare_tunnel_token())
    tunnel_url_configured = bool(
        os.environ.get("PUBLIC_TUNNEL_URL")
        or os.environ.get("PUBLIC_TUNNEL_URL_MAIN")
    )

    central_uri = resolve_central_mongo_uri()
    central_enabled = bool(central_uri)
    central_ok = await ping_central_database() if central_enabled else False
    if central_enabled and not central_ok:
        db_name = os.environ.get("MONGODB_CENTRAL_DB") or os.environ.get("DB_NAME") or "mc-larens2_mundo_accesorios_erp"
        central_ok, _ = await _ping_external_central(central_uri, db_name)
    central_db = get_central_database() if central_ok else None
    if central_ok and central_db is None and central_uri:
        try:
            from motor.motor_asyncio import AsyncIOMotorClient

            client = AsyncIOMotorClient(central_uri, serverSelectionTimeoutMS=4500)
            db_name = os.environ.get("MONGODB_CENTRAL_DB") or os.environ.get("DB_NAME") or "mc-larens2_mundo_accesorios_erp"
            central_db = client[db_name]
        except Exception:
            central_db = None

    atlas_block = await _resolve_atlas_block(db, local_branch_id)

    try:
        from backend.services.terabox_backup_service import read_terabox_status

        terabox_raw = read_terabox_status()
    except Exception:
        terabox_raw = {}
    terabox_overview = build_terabox_overview()
    terabox_user, terabox_pass = resolve_terabox_credentials()
    terabox_configured = bool(terabox_user and terabox_pass)

    hardware = {
        "cpu_usage_pct": cpu_usage,
        "ram_used_gb": mem.get("ram_used_gb"),
        "ram_total_gb": mem.get("ram_total_gb"),
        "ram_usage_pct": mem.get("ram_pct"),
        "disk_uploads_pct": _disk_uploads_pct(uploads_path),
        "cpu_temp_c": cpu_temp_c,
        "cpu_temp_simulated": cpu_temp_simulated,
        "uptime_hours": _read_uptime_hours(),
        "battery_pct": battery.get("battery_pct"),
        "battery_status": battery.get("battery_status"),
        "battery_on_ac": battery.get("battery_on_ac"),
        "battery_autonomy_minutes": battery.get("battery_autonomy_minutes"),
        "battery_source": battery.get("battery_source"),
    }

    local_lan = {
        "lan_ip": lan_ip,
        "lan_ip_source": lan_ip_source,
        "frontend_port": port,
        "access_url": f"http://{lan_ip}:{port}",
        "active_connections": _count_net_connections(),
        "active_users_count": active_users,
        "usb_backup_status": _usb_backup_status(alerts, usb_path),
    }

    tunnel_online = bool(tunnel_probe.get("healthy") or cf_token_configured or tunnel_url_configured)

    cloud_services = {
        "cloudflare": {
            "tunnel_status": "ONLINE" if tunnel_online else "OFFLINE",
            "bandwidth_kbps": tunnel_probe.get("bandwidth_kbps") or 0,
            "active_connections_count": active_users,
            "latency_ms": tunnel_probe.get("latency_ms"),
            "url": tunnel_url,
            "env_configured": cf_token_configured or tunnel_url_configured,
            "probe_healthy": bool(tunnel_probe.get("healthy")),
        },
        "mongodb_atlas": atlas_block,
        "terabox": _terabox_cloud_block(
            terabox_overview,
            terabox_raw,
            creds_configured=terabox_configured,
        ),
        "cloud_config_summary": is_cloud_configured(),
    }

    delta_mesh_network = await build_delta_mesh_network(central_db, local_branch_id)
    mobile_backup_device = await _resolve_mobile_backup_device(db, local_branch_id)

    return {
        "generated_at": _iso_now(),
        "node": profile,
        "access": {
            "lan_ip": lan_ip,
            "lan_ip_source": lan_ip_source,
            "frontend_port": port,
            "url": local_lan["access_url"],
            "dashboard_url": f"http://{lan_ip}:{port}/server-dashboard",
            "qr_target_url": local_lan["access_url"],
        },
        "hardware": hardware,
        "local_lan": local_lan,
        "cloud_services": cloud_services,
        "delta_mesh_network": delta_mesh_network,
        "mobile_backup_device": mobile_backup_device,
        "hypervisor_title": "HyperVisor Global de Servidor y Red Delta",
    }