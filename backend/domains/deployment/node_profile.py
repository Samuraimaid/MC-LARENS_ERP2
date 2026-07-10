from __future__ import annotations

import os
from typing import Any, Dict, List


def _env_bool(key: str, default: bool = False) -> bool:
    raw = str(os.environ.get(key, "")).strip().lower()
    if not raw:
        return default
    return raw in {"1", "true", "yes", "on", "y"}


def resolve_node_type() -> str:
    value = str(os.environ.get("NODE_TYPE", "SUCURSAL")).strip().upper()
    if value in {"SUCURSAL", "BODEGA_PURA", "CASA_MATRIZ"}:
        return value
    return "SUCURSAL"


def build_node_profile() -> Dict[str, Any]:
    node_type = resolve_node_type()
    node_id = str(os.environ.get("BRANCH_ID") or os.environ.get("NODE_ID") or "branch_main").strip()
    node_name = str(os.environ.get("NODE_NAME") or os.environ.get("BRANCH_NAME") or node_id).strip()

    if node_type == "BODEGA_PURA":
        features = {
            "sales": False,
            "workshop": False,
            "hr": False,
            "warehouse_count": True,
            "dispatch": True,
            "transfers": True,
            "server_dashboard": True,
        }
    else:
        features = {
            "sales": _env_bool("NODE_ENABLE_SALES", True),
            "workshop": _env_bool("NODE_ENABLE_WORKSHOP", True),
            "hr": _env_bool("NODE_ENABLE_HR", True),
            "warehouse_count": True,
            "dispatch": True,
            "transfers": True,
            "server_dashboard": True,
        }

    disabled_routes = _routes_disabled_by_features(features)
    return {
        "node_id": node_id,
        "node_name": node_name,
        "node_type": node_type,
        "features": features,
        "disabled_routes": disabled_routes,
        "lan_ip": str(os.environ.get("SERVER_LAN_IP") or "192.168.1.26").strip(),
        "frontend_port": int(os.environ.get("SERVER_FRONTEND_PORT") or "3000"),
    }


def _routes_disabled_by_features(features: Dict[str, bool]) -> List[str]:
    disabled: List[str] = []
    if not features.get("sales"):
        disabled.extend([
            "/workbench",
            "/cashier",
            "/quotations",
            "/sales",
            "/catalog",
            "/customers",
            "/vehicles",
            "/credits",
            "/returns",
            "/promotions",
            "/reports",
        ])
    if not features.get("workshop"):
        disabled.extend([
            "/work-orders",
            "/coordinator",
            "/coordinator/instalaciones",
            "/coordinator/polarizados",
            "/technician",
            "/my-completed-jobs",
            "/tint-orders",
            "/calendar",
            "/quality-control",
            "/kds/instalaciones",
            "/kds/polarizados",
            "/warranties",
        ])
    if not features.get("hr"):
        disabled.extend(["/human-resources", "/attendance-clock", "/accounting"])
    if not features.get("dispatch"):
        disabled.append("/dispatch")
    if not features.get("transfers"):
        disabled.append("/product-transfers")
    if not features.get("warehouse_count"):
        disabled.extend(["/inventory", "/kds/bodega"])
    return sorted(set(disabled))


def is_route_enabled(route: str, profile: Dict[str, Any] | None = None) -> bool:
    data = profile or build_node_profile()
    normalized = str(route or "").split("?")[0].rstrip("/") or "/"
    disabled = set(data.get("disabled_routes") or [])
    for blocked in disabled:
        if normalized == blocked or normalized.startswith(f"{blocked}/"):
            return False
    return True