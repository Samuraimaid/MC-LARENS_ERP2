"""
Sistema Central de Audit Logging de Mutaciones Críticas y Detección de Señales de Abuso.
MC-LARENS ERP2 - Fase 2 Seguridad P1 (S4 + C4: Top 12 #10 Audit Logging + Case C4 Abuso).

Garantías del módulo:
1. S4: Registro estricto de mutaciones críticas (Venta, Cobro, Anulación, Login PIN, Inventario).
   - Registra: user_id, path, action, resource_id, status (ok/fail), ip, timestamp, details.
   - Higiene de seguridad CRITICAL: Scrubbing y redacción automática de secretos
     (PINs, tokens de sesión, Bearer tokens, contraseñas, datos de tarjetas).
2. C4: Observabilidad y Detección de Señales de Abuso en tiempo real.
   - Picos 401 (fuerza bruta / PIN incorrecto consecutivo).
   - Picos 429 (ráfagas bloqueadas por Rate Limiting).
   - Ráfagas de fallos en finalización / settlement (tampering o inconsistencias monetarias).
   - Generación de logs estructurados [ABUSE_SIGNAL] y persistencia en security_abuse_events.
"""
from __future__ import annotations

import logging
import re
import time
import uuid
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set, Tuple

logger = logging.getLogger(__name__)

# Palabras clave y subcadenas que deben ser redactadas incondicionalmente
SENSITIVE_KEY_PATTERNS: Set[str] = {
    "pin",
    "token",
    "session_token",
    "password",
    "secret",
    "authorization",
    "auth",
    "cvv",
    "card_number",
    "pan",
    "cookie",
    "access_token",
    "refresh_token",
    "private_key",
    "api_key",
}

# Regex para detectar Authorization headers o tokens en strings
BEARER_PATTERN = re.compile(r"Bearer\s+[A-Za-z0-9\-_.]+", re.IGNORECASE)


def sanitize_for_audit(data: Any, max_depth: int = 5) -> Any:
    """
    Higieniza estructuras de datos de manera recursiva eliminando cualquier secreto,
    PIN o token antes de escribir en disco, MongoDB o stdout.
    """
    if max_depth <= 0 or data is None:
        return data

    if isinstance(data, dict):
        sanitized = {}
        for k, v in data.items():
            key_str = str(k).lower().strip()
            # Si el nombre de la clave contiene o coincide con un patrón sensible
            if any(p in key_str for p in SENSITIVE_KEY_PATTERNS):
                sanitized[k] = "[REDACTED]"
            else:
                sanitized[k] = sanitize_for_audit(v, max_depth - 1)
        return sanitized

    if isinstance(data, list):
        return [sanitize_for_audit(item, max_depth - 1) for item in data]

    if isinstance(data, tuple):
        return tuple(sanitize_for_audit(item, max_depth - 1) for item in data)

    if isinstance(data, set):
        return {sanitize_for_audit(item, max_depth - 1) for item in data}

    if isinstance(data, str):
        # Redactar cadenas que incluyan cabeceras Bearer
        if "Bearer " in data or "bearer " in data:
            return BEARER_PATTERN.sub("Bearer [REDACTED]", data)
        return data

    return data


async def record_critical_mutation(
    db: Optional[Any],
    *,
    user_id: Optional[str],
    action: str,
    resource_id: Optional[str] = None,
    path: str = "",
    status: str = "ok",
    ip: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
    reason: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Registra una mutación crítica en la base de datos de auditoría y en los logs del servidor.
    Tanto los intentos exitosos (status='ok') como los fallidos (status='fail') quedan trazados.
    """
    clean_status = "ok" if str(status).lower() in {"ok", "success", "true"} else "fail"
    clean_action = str(action).upper().strip()
    clean_user = str(user_id or "anonymous").strip()
    clean_resource = str(resource_id or "").strip() or None
    clean_ip = str(ip or "unknown").strip()
    sanitized_details = sanitize_for_audit(details or {})

    record = {
        "audit_id": f"crit_{uuid.uuid4().hex[:12]}",
        "user_id": clean_user,
        "action": clean_action,
        "resource_id": clean_resource,
        "path": path,
        "status": clean_status,
        "ip": clean_ip,
        "details": sanitized_details,
        "reason": reason,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    # Emitir log estructurado de auditoría
    if clean_status == "ok":
        logger.info(
            "[AUDIT_MUTATION] status=ok user=%s action=%s resource=%s path=%s ip=%s",
            clean_user,
            clean_action,
            clean_resource,
            path,
            clean_ip,
        )
    else:
        logger.warning(
            "[AUDIT_MUTATION] status=fail user=%s action=%s resource=%s path=%s ip=%s reason=%s",
            clean_user,
            clean_action,
            clean_resource,
            path,
            clean_ip,
            reason or "unspecified",
        )

    # Persistencia en MongoDB si la conexión existe
    if db is not None:
        try:
            coll = getattr(db, "critical_audit_logs", None)
            if coll is not None and hasattr(coll, "insert_one"):
                await coll.insert_one(dict(record))
        except Exception:
            logger.exception("Error al persistir registro en critical_audit_logs")

    return record


class AbuseSignalTracker:
    """
    Detector en memoria de patrones de abuso (C4) utilizando ventanas deslizantes.
    Monitorea ráfagas de 401 (PIN / auth), 429 (Rate Limit) y fallos repetidos de finalización.
    """

    # Umbrales por defecto por tipo de señal (ocurrencias en la ventana de segundos)
    DEFAULT_THRESHOLDS: Dict[str, Tuple[int, int]] = {
        # signal_type: (max_allowed_events, window_seconds)
        "401_BURST": (5, 60),       # 5 fallos de autenticación en 60s
        "429_SPIKE": (5, 60),       # 5 bloqueos de rate limit en 60s
        "FINALIZE_FAIL": (3, 60),   # 3 fallos de finalización / mismatch en 60s
    }

    def __init__(self):
        # signal_type -> identifier -> list of float timestamps
        self._events: Dict[str, Dict[str, List[float]]] = defaultdict(lambda: defaultdict(list))

    async def record_signal(
        self,
        signal_type: str,
        identifier: str,
        ip: str = "unknown",
        details: Optional[Dict[str, Any]] = None,
        db: Optional[Any] = None,
        now: Optional[float] = None,
    ) -> Tuple[bool, int, Optional[Dict[str, Any]]]:
        """
        Registra un evento de señal. Si la tasa acumulada alcanza o supera el umbral,
        activa una señal de abuso [ABUSE_SIGNAL] y opcionalmente persiste el evento de alarma.
        Retorna (is_abuse: bool, count: int, alert_record: Optional[dict]).
        """
        current_time = now if now is not None else time.time()
        sig = str(signal_type).upper().strip()
        key = str(identifier or ip or "unknown").strip()

        threshold, window_seconds = self.DEFAULT_THRESHOLDS.get(sig, (5, 60))
        window_start = current_time - window_seconds

        timestamps = self._events[sig][key]
        valid_timestamps = [t for t in timestamps if t > window_start]
        valid_timestamps.append(current_time)
        self._events[sig][key] = valid_timestamps

        count = len(valid_timestamps)
        is_abuse = count >= threshold

        alert_doc: Optional[Dict[str, Any]] = None
        if is_abuse:
            sanitized_details = sanitize_for_audit(details or {})
            alert_doc = {
                "event_id": f"abuse_{uuid.uuid4().hex[:12]}",
                "signal_type": sig,
                "identifier": key,
                "ip": ip,
                "count": count,
                "threshold": threshold,
                "window_seconds": window_seconds,
                "details": sanitized_details,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }

            logger.warning(
                "[ABUSE_SIGNAL] alert=true signal=%s key=%s count=%d threshold=%d window=%ds ip=%s details=%s",
                sig,
                key,
                count,
                threshold,
                window_seconds,
                ip,
                sanitized_details,
            )

            if db is not None:
                try:
                    coll = getattr(db, "security_abuse_events", None)
                    if coll is not None and hasattr(coll, "insert_one"):
                        await coll.insert_one(dict(alert_doc))
                except Exception:
                    logger.exception("Error al persistir evento de abuso en security_abuse_events")

        return is_abuse, count, alert_doc

    def get_count(self, signal_type: str, identifier: str, window_seconds: int = 60, now: Optional[float] = None) -> int:
        """Retorna el conteo actual de eventos en la ventana de tiempo."""
        current_time = now if now is not None else time.time()
        sig = str(signal_type).upper().strip()
        key = str(identifier).strip()
        window_start = current_time - window_seconds
        return len([t for t in self._events[sig][key] if t > window_start])

    def reset_key(self, signal_type: str, identifier: str) -> None:
        """Limpia el conteo de una clave específica."""
        sig = str(signal_type).upper().strip()
        key = str(identifier).strip()
        if sig in self._events and key in self._events[sig]:
            del self._events[sig][key]

    def clear(self) -> None:
        """Limpia todo el estado en memoria."""
        self._events.clear()


# Instancia global del rastreador de abuso
abuse_tracker = AbuseSignalTracker()


async def record_abuse_signal(
    signal_type: str,
    identifier: str,
    ip: str = "unknown",
    details: Optional[Dict[str, Any]] = None,
    db: Optional[Any] = None,
) -> Tuple[bool, int, Optional[Dict[str, Any]]]:
    """Helper global para registrar una señal de abuso contra la instancia compartida."""
    return await abuse_tracker.record_signal(
        signal_type=signal_type,
        identifier=identifier,
        ip=ip,
        details=details,
        db=db,
    )


async def ensure_audit_indexes(db: Any) -> None:
    """Crea índices recomendados para las colecciones de auditoría y abuso."""
    if db is None:
        return
    try:
        # Colección de mutaciones críticas: índice por timestamp descendente y por user_id
        if hasattr(db, "critical_audit_logs"):
            await db.critical_audit_logs.create_index([("timestamp", -1)])
            await db.critical_audit_logs.create_index([("user_id", 1), ("action", 1)])
            await db.critical_audit_logs.create_index([("resource_id", 1)])

        # Colección de abuso: TTL de 30 días en MongoDB
        if hasattr(db, "security_abuse_events"):
            await db.security_abuse_events.create_index([("timestamp", -1)])
            await db.security_abuse_events.create_index([("identifier", 1), ("signal_type", 1)])
            # TTL index opcional de 30 días (2,592,000 segundos) si el campo es tipo Date,
            # pero como usamos ISO string dejamos el índice compuesto ordenado.
    except Exception:
        logger.exception("No se pudieron inicializar los índices de auditoría")
