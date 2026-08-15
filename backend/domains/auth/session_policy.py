"""Session TTL, idle timeout and re-PIN policy for the ERP.

Defaults (override via Mongo settings type=session_security_policy or env):
- ventas (piso + VIP, same role): idle 5 minutes
- all other roles: idle 60 minutes
- absolute TTL by role (hours)
"""
from __future__ import annotations

import os
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Set, Tuple

POLICY_DOC_TYPE = "session_security_policy"

# Idle: ventas (incl. VIP sellers share role=ventas) = 5 min; others = 60 min
DEFAULT_IDLE_MINUTES: Dict[str, int] = {
    "ventas": 5,
    "default": 60,
}

DEFAULT_TTL_HOURS: Dict[str, int] = {
    "ventas": 12,
    "cajero": 12,
    "bodegas": 12,
    "instalaciones": 12,
    "electrico": 12,
    "polarizador": 12,
    "supervisor": 8,
    "jefe_tienda": 8,
    "jefe_vendedores": 8,
    "coordinador_instalaciones": 8,
    "coordinador_polarizados": 8,
    "recursos_humanos": 8,
    "gerencia": 4,
    "programador": 4,
    "default": 12,
}

# Actions that require a fresh PIN confirmation (X-Reauth-Token)
DEFAULT_REAUTH_ACTIONS: Dict[str, bool] = {
    "users.create": True,
    "users.edit": True,
    "users.pin_reset": True,
    "users.login_pin": True,
    "users.role": True,
    "sessions.list": False,
    "sessions.revoke": True,
    "settings.session_policy": True,
    "settings.system": True,
    "settings.billing": True,
    "settings.permissions": True,
    "caja.anular": True,
    "caja.clear_queue": True,
    "dispatch.clear_queue": True,
    "coordinator.clear_queue": True,
    "tutorials.edit": True,
    "tutorials.reset": True,
    "backup.download": True,
    "backup.restore": True,
    "sales.request_cancel": False,
    "sales.approve_cancel": True,
    "sales.approve_edit": True,
}

DEFAULT_REAUTH_TTL_SECONDS = 120
DEFAULT_HEARTBEAT_THROTTLE_SECONDS = 30

VENTAS_ROLES: Set[str] = {"ventas"}


def _clamp_int(value: Any, *, minimum: int, maximum: int, default: int) -> int:
    try:
        n = int(value)
    except (TypeError, ValueError):
        return default
    return max(minimum, min(maximum, n))


def default_session_policy() -> Dict[str, Any]:
    return {
        "type": POLICY_DOC_TYPE,
        "idle_minutes": dict(DEFAULT_IDLE_MINUTES),
        "ttl_hours": dict(DEFAULT_TTL_HOURS),
        "reauth_actions": dict(DEFAULT_REAUTH_ACTIONS),
        "reauth_ttl_seconds": DEFAULT_REAUTH_TTL_SECONDS,
        "heartbeat_throttle_seconds": DEFAULT_HEARTBEAT_THROTTLE_SECONDS,
        "single_session": True,
        "notes": (
            "ventas (piso y VIP) usan idle de 5 min por defecto; "
            "resto de roles 60 min. TTL absoluto limita la vida total de la cookie."
        ),
    }


def _merge_int_map(
    base: Dict[str, int],
    override: Any,
    *,
    minimum: int,
    maximum: int,
) -> Dict[str, int]:
    out = dict(base)
    if not isinstance(override, dict):
        return out
    for key, raw in override.items():
        k = str(key or "").strip().lower()
        if not k:
            continue
        out[k] = _clamp_int(raw, minimum=minimum, maximum=maximum, default=out.get(k, out.get("default", minimum)))
    return out


def normalize_session_policy(raw: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    base = default_session_policy()
    if not isinstance(raw, dict):
        return base
    idle = _merge_int_map(
        base["idle_minutes"],
        raw.get("idle_minutes"),
        minimum=1,
        maximum=24 * 60,
    )
    # Force ventas key present
    if "ventas" not in idle:
        idle["ventas"] = DEFAULT_IDLE_MINUTES["ventas"]
    if "default" not in idle:
        idle["default"] = DEFAULT_IDLE_MINUTES["default"]

    ttl = _merge_int_map(
        base["ttl_hours"],
        raw.get("ttl_hours"),
        minimum=1,
        maximum=24 * 14,
    )
    if "default" not in ttl:
        ttl["default"] = DEFAULT_TTL_HOURS["default"]

    reauth = dict(DEFAULT_REAUTH_ACTIONS)
    if isinstance(raw.get("reauth_actions"), dict):
        for key, val in raw["reauth_actions"].items():
            k = str(key or "").strip()
            if k:
                reauth[k] = bool(val)

    return {
        "type": POLICY_DOC_TYPE,
        "idle_minutes": idle,
        "ttl_hours": ttl,
        "reauth_actions": reauth,
        "reauth_ttl_seconds": _clamp_int(
            raw.get("reauth_ttl_seconds"),
            minimum=30,
            maximum=900,
            default=DEFAULT_REAUTH_TTL_SECONDS,
        ),
        "heartbeat_throttle_seconds": _clamp_int(
            raw.get("heartbeat_throttle_seconds"),
            minimum=10,
            maximum=120,
            default=DEFAULT_HEARTBEAT_THROTTLE_SECONDS,
        ),
        "single_session": bool(raw.get("single_session", True)),
        "notes": str(raw.get("notes") or base["notes"]),
        "updated_at": raw.get("updated_at"),
        "updated_by": raw.get("updated_by"),
        "updated_by_name": raw.get("updated_by_name"),
    }


def resolve_role_key(role: Optional[str]) -> str:
    return str(role or "").strip().lower() or "default"


def idle_minutes_for_role(policy: Dict[str, Any], role: Optional[str]) -> int:
    """Ventas (piso + VIP) share role=ventas -> 5 min default; others use role or default."""
    idle_map = policy.get("idle_minutes") or DEFAULT_IDLE_MINUTES
    key = resolve_role_key(role)
    if key in VENTAS_ROLES:
        return int(idle_map.get("ventas") or DEFAULT_IDLE_MINUTES["ventas"])
    if key in idle_map:
        return int(idle_map[key])
    return int(idle_map.get("default") or DEFAULT_IDLE_MINUTES["default"])


def ttl_hours_for_role(policy: Dict[str, Any], role: Optional[str]) -> int:
    ttl_map = policy.get("ttl_hours") or DEFAULT_TTL_HOURS
    key = resolve_role_key(role)
    if key in ttl_map:
        return int(ttl_map[key])
    return int(ttl_map.get("default") or DEFAULT_TTL_HOURS["default"])


def action_requires_reauth(policy: Dict[str, Any], action_key: str) -> bool:
    actions = policy.get("reauth_actions") or {}
    return bool(actions.get(str(action_key or "").strip(), False))


def parse_iso_dt(raw: Any) -> Optional[datetime]:
    text = str(raw or "").strip()
    if not text:
        return None
    try:
        dt = datetime.fromisoformat(text.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return None


def session_expiry_iso(policy: Dict[str, Any], role: Optional[str], *, now: Optional[datetime] = None) -> str:
    now = now or datetime.now(timezone.utc)
    hours = ttl_hours_for_role(policy, role)
    return (now + timedelta(hours=hours)).isoformat()


def validate_session_freshness(
    session: Dict[str, Any],
    *,
    role: Optional[str],
    policy: Dict[str, Any],
    now: Optional[datetime] = None,
) -> Tuple[bool, Optional[str], Optional[str]]:
    """
    Returns (ok, error_code, message).
    Codes: SESSION_EXPIRED, SESSION_IDLE_TIMEOUT
    """
    now = now or datetime.now(timezone.utc)
    expires = parse_iso_dt(session.get("expires_at"))
    if expires is not None and expires < now:
        return False, "SESSION_EXPIRED", "La sesión ha expirado. Vuelve a iniciar sesión con tu PIN."

    idle_min = idle_minutes_for_role(policy, role)
    last_seen = parse_iso_dt(session.get("last_seen_at")) or parse_iso_dt(session.get("created_at"))
    if last_seen is not None:
        idle_seconds = (now - last_seen).total_seconds()
        if idle_seconds > idle_min * 60:
            return (
                False,
                "SESSION_IDLE_TIMEOUT",
                f"Sesión cerrada por inactividad ({idle_min} min). Inicia sesión de nuevo.",
            )
    return True, None, None


def policy_from_env_overlay(policy: Dict[str, Any]) -> Dict[str, Any]:
    """Optional env overrides: SESSION_IDLE_MINUTES_VENTAS, SESSION_IDLE_MINUTES_DEFAULT, etc."""
    out = deepcopy(policy)
    ventas_idle = os.environ.get("SESSION_IDLE_MINUTES_VENTAS")
    default_idle = os.environ.get("SESSION_IDLE_MINUTES_DEFAULT")
    if ventas_idle is not None:
        out["idle_minutes"]["ventas"] = _clamp_int(
            ventas_idle, minimum=1, maximum=24 * 60, default=5
        )
    if default_idle is not None:
        out["idle_minutes"]["default"] = _clamp_int(
            default_idle, minimum=1, maximum=24 * 60, default=60
        )
    return out


def list_reauth_action_catalog() -> List[Dict[str, Any]]:
    labels = {
        "users.create": "Crear usuarios",
        "users.edit": "Editar usuarios",
        "users.pin_reset": "Reset de PIN",
        "users.login_pin": "Cambiar PIN de login",
        "users.role": "Cambiar rol de usuario",
        "sessions.revoke": "Cerrar sesiones ajenas",
        "settings.session_policy": "Política de sesión / timeouts",
        "settings.system": "Ajustes de sistema",
        "settings.billing": "Ajustes de facturación",
        "settings.permissions": "Permisos de roles",
        "caja.anular": "Anular factura en caja",
        "caja.clear_queue": "Limpiar cola de caja",
        "dispatch.clear_queue": "Limpiar cola de despacho",
        "coordinator.clear_queue": "Limpiar cola de coordinación",
        "tutorials.edit": "Editar tutoriales",
        "tutorials.reset": "Resetear tutoriales",
        "backup.download": "Descargar respaldo",
        "backup.restore": "Restaurar respaldo",
        "sales.approve_cancel": "Aprobar anulación de venta",
        "sales.approve_edit": "Aprobar edición de venta",
    }
    return [
        {
            "key": key,
            "label": labels.get(key, key),
            "default": bool(DEFAULT_REAUTH_ACTIONS.get(key)),
        }
        for key in sorted(DEFAULT_REAUTH_ACTIONS.keys())
    ]
