"""HyperVisor Global — unified server & delta mesh telemetry."""
from __future__ import annotations

import os
import shutil
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx

from backend.db.distributed import get_central_database, ping_central_database, resolve_central_mongo_uri
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

        return round(float(psutil.cpu_percent(interval=0.15)), 1)
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


def _terabox_cloud_block(terabox_overview: Dict[str, Any], terabox_raw: Dict[str, Any]) -> Dict[str, Any]:
    used_bytes = int(terabox_overview.get("used_space_bytes") or terabox_raw.get("space_used_bytes") or 0)
    used_gb = round(used_bytes / (1024 ** 3), 2)
    sync_ok = terabox_raw.get("last_upload_status") == "success"
    sync_pct = 100.0 if sync_ok else (50.0 if terabox_raw.get("connected") else 0.0)
    return {
        "status": "CONNECTED" if terabox_overview.get("connected") or terabox_raw.get("connected") else "DISCONNECTED",
        "storage_used_gb": used_gb,
        "storage_total_gb": TERABOX_TOTAL_GB,
        "sync_success_pct": round(sync_pct, 1),
        "last_backup_time": terabox_raw.get("last_upload_at"),
        "used_pct": terabox_overview.get("used_percentage"),
        "folders": terabox_overview.get("folders") or [],
    }


async def build_hypervisor_dashboard(db) -> Dict[str, Any]:
    profile = build_node_profile()
    lan_ip = profile.get("lan_ip") or os.environ.get("SERVER_LAN_IP") or "192.168.1.26"
    port = int(profile.get("frontend_port") or os.environ.get("SERVER_FRONTEND_PORT") or 3000)
    uploads_path = os.environ.get("LOCAL_UPLOAD_ROOT", "/app/uploads")
    usb_path = os.environ.get("USB_BACKUP_ROOT", "/mnt/usb_backup")
    local_branch_id = str(os.environ.get("BRANCH_ID") or profile.get("node_id") or "branch_main").strip()

    mem = _read_memory_gb()
    alerts = get_active_alerts()
    active_users = await _count_active_users(db)

    tunnel_url = (
        os.environ.get("PUBLIC_TUNNEL_URL")
        or os.environ.get("PUBLIC_TUNNEL_URL_MAIN")
        or "https://mclarenerp.com"
    ).rstrip("/")
    tunnel_probe = await _probe_tunnel(tunnel_url)

    central_enabled = bool(resolve_central_mongo_uri())
    central_ok = await ping_central_database() if central_enabled else False
    central_db = get_central_database() if central_ok else None

    atlas_used_mb = None
    atlas_pct = None
    if central_ok and central_db is not None:
        try:
            stats = await central_db.command("dbStats")
            used_bytes = int(stats.get("storageSize") or 0) + int(stats.get("indexSize") or 0)
            atlas_used_mb = round(used_bytes / (1024 ** 2), 1)
            atlas_pct = round((used_bytes / (ATLAS_TOTAL_MB * 1024 ** 2)) * 100, 1)
        except Exception:
            pass

    try:
        from backend.services.terabox_backup_service import read_terabox_status

        terabox_raw = read_terabox_status()
    except Exception:
        terabox_raw = {}
    terabox_overview = build_terabox_overview()

    hardware = {
        "cpu_usage_pct": _read_cpu_percent(),
        "ram_used_gb": mem.get("ram_used_gb"),
        "ram_total_gb": mem.get("ram_total_gb"),
        "ram_usage_pct": mem.get("ram_pct"),
        "disk_uploads_pct": _disk_uploads_pct(uploads_path),
        "cpu_temp_c": _read_temperature_c(),
        "uptime_hours": _read_uptime_hours(),
    }

    local_lan = {
        "lan_ip": lan_ip,
        "frontend_port": port,
        "access_url": f"http://{lan_ip}:{port}",
        "active_connections": _count_net_connections(),
        "active_users_count": active_users,
        "usb_backup_status": _usb_backup_status(alerts, usb_path),
    }

    cloud_services = {
        "cloudflare": {
            "tunnel_status": "ONLINE" if tunnel_probe.get("healthy") else "OFFLINE",
            "bandwidth_kbps": tunnel_probe.get("bandwidth_kbps") or 0,
            "active_connections_count": active_users,
            "latency_ms": tunnel_probe.get("latency_ms"),
            "url": tunnel_url,
        },
        "mongodb_atlas": {
            "status": "CONNECTED" if central_ok else ("DISABLED" if not central_enabled else "DISCONNECTED"),
            "size_used_mb": atlas_used_mb,
            "size_total_mb": ATLAS_TOTAL_MB,
            "used_pct": atlas_pct,
        },
        "terabox": _terabox_cloud_block(terabox_overview, terabox_raw),
    }

    delta_mesh_network = await build_delta_mesh_network(central_db, local_branch_id)

    return {
        "generated_at": _iso_now(),
        "node": profile,
        "access": {
            "lan_ip": lan_ip,
            "frontend_port": port,
            "url": local_lan["access_url"],
            "dashboard_url": f"http://{lan_ip}:{port}/server-dashboard",
            "qr_target_url": local_lan["access_url"],
        },
        "hardware": hardware,
        "local_lan": local_lan,
        "cloud_services": cloud_services,
        "delta_mesh_network": delta_mesh_network,
        "hypervisor_title": "HyperVisor Global de Servidor y Red Delta",
    }