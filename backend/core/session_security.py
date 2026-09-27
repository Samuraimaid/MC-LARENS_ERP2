"""
Módulo de Seguridad de Sesión, Timeouts de Inactividad (Idle TTL) e Invalidación de Sesiones.
MC-LARENS ERP2 - Fase 2 Seguridad P1 (Top 12 #1 Authentication + Case C2 Sesión).

Garantías:
1. Timeouts de Inactividad (Idle) y TTL Absoluto:
   - Ventas (Kiosco / Piso): 5 minutos de inactividad.
   - Cajero: 8–12 horas (por defecto 10 horas / 600 min) para cubrir el turno continuo de caja.
   - TTL absoluto máximo por defecto: 12 horas.
   - Detección precisa de sesiones vencidas o inactivas retornando códigos SESSION_EXPIRED / SESSION_IDLE_TIMEOUT.
2. Invalidación Inmediata de Sesiones:
   - Al cerrar turno en caja (`POST /caja/cierre`), las sesiones del cajero quedan revocadas.
   - Al cambiar rol o privilegios de un usuario (`PUT /users/{user_id}/role`), todas las sesiones activas
     se revocan inmediatamente para forzar un re-login con los nuevos permisos.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Tuple

from backend.domains.auth.session_policy import (
    default_session_policy,
    idle_minutes_for_role,
    parse_iso_dt,
    ttl_hours_for_role,
    validate_session_freshness,
)

logger = logging.getLogger(__name__)


async def invalidate_user_sessions(db: Any, user_id: str, reason: str = "security") -> int:
    """
    Revoca inmediatamente todas las sesiones activas en base de datos para un usuario dado.
    Utilizado tras un cambio de rol/privilegio o al cierre de turno de caja.
    """
    if db is None or not user_id:
        return 0
    try:
        coll = getattr(db, "sessions", None)
        if coll is not None and hasattr(coll, "delete_many"):
            res = await coll.delete_many({"user_id": str(user_id).strip()})
            deleted = int(getattr(res, "deleted_count", 0))
            logger.info(
                "[SESSION_INVALIDATED] user_id=%s count=%d reason=%s",
                user_id,
                deleted,
                reason,
            )
            return deleted
    except Exception:
        logger.exception("Error al invalidar sesiones para usuario %s", user_id)
    return 0


async def revoke_user_sessions_for_concurrent_login(
    db: Any,
    user_id: str,
    ip: str = "",
    user_agent: str = "",
) -> int:
    """
    Marca las sesiones activas previas de un usuario como revocadas por conflicto de concurrencia
    en lugar de borrarlas inmediatamente, permitiendo que el cliente anterior reciba SESSION_CONFLICT
    y sea expulsado en tiempo real con una notificación descriptiva.
    """
    if db is None or not user_id:
        return 0
    try:
        coll = getattr(db, "sessions", None)
        if coll is not None:
            now_iso = datetime.now(timezone.utc).isoformat()
            target_uid = str(user_id).strip()
            # 1. Purgar sesiones revocadas muy antiguas de este usuario (> 2 horas)
            if hasattr(coll, "delete_many"):
                two_hours_ago = (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()
                await coll.delete_many({
                    "user_id": target_uid,
                    "revoked": True,
                    "revoked_at": {"$lt": two_hours_ago},
                })
            # 2. Marcar las sesiones activas previas como revocadas por login concurrente
            if hasattr(coll, "update_many"):
                res = await coll.update_many(
                    {"user_id": target_uid, "revoked": {"$ne": True}},
                    {
                        "$set": {
                            "revoked": True,
                            "revoked_reason": "concurrent_login",
                            "revoked_at": now_iso,
                            "revoked_by_ip": ip,
                            "revoked_by_ua": (user_agent or "")[:120],
                        }
                    },
                )
                modified = int(getattr(res, "modified_count", 0))
                if modified > 0:
                    logger.warning(
                        "[CONCURRENT_SESSION_REVOKED] user_id=%s count=%d new_ip=%s",
                        user_id,
                        modified,
                        ip,
                    )
                return modified
    except Exception:
        logger.exception("Error al marcar sesiones revocadas por login concurrente para %s", user_id)
    return 0


async def invalidate_session_token(db: Any, session_token: str, reason: str = "logout") -> int:
    """Revoca un token de sesión específico de la base de datos."""
    if db is None or not session_token:
        return 0
    try:
        coll = getattr(db, "sessions", None)
        if coll is not None and hasattr(coll, "delete_many"):
            res = await coll.delete_many({"session_token": str(session_token).strip()})
            return int(getattr(res, "deleted_count", 0))
    except Exception:
        logger.exception("Error al invalidar token de sesión")
    return 0


def check_session_validity(
    session: Dict[str, Any],
    role: Optional[str] = None,
    policy: Optional[Dict[str, Any]] = None,
    now: Optional[datetime] = None,
) -> Tuple[bool, Optional[str], Optional[str]]:
    """
    Verifica si una sesión sigue siendo válida respecto a su TTL absoluto y timeout por inactividad.
    Retorna (is_valid: bool, error_code: Optional[str], error_message: Optional[str]).
    """
    active_policy = policy or default_session_policy()
    return validate_session_freshness(
        session=session,
        role=role,
        policy=active_policy,
        now=now or datetime.now(timezone.utc),
    )
