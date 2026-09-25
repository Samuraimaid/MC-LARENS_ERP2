"""
Módulo de Idempotencia para Operaciones Financieras y Mutaciones Críticas.
MC-LARENS ERP2 - S1 (Top 12 API Security #9 + Case Hardening).

Permite que clientes que reintenten mutaciones (ej. pérdida de red, doble clic)
reciban la respuesta previa sin duplicar cobros, ventas ni movimientos de inventario.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import hashlib
import json
import logging
from typing import Any, Dict, Optional, Tuple
try:
    from fastapi import HTTPException, Request
except ImportError:
    Request = Any  # type: ignore

    class HTTPException(Exception):  # type: ignore
        def __init__(self, status_code: int = 400, detail: Any = None):
            self.status_code = status_code
            self.detail = detail
            super().__init__(f"HTTP {status_code}: {detail}")

logger = logging.getLogger(__name__)

# En memoria para fallback y protección contra condiciones de carrera concurrentes
_IN_PROGRESS_LOCKS: Dict[str, asyncio.Lock] = {}
_MEMORY_IDEMPOTENCY_CACHE: Dict[str, Dict[str, Any]] = {}


def extract_idempotency_key(
    request: Optional[Request] = None,
    payload_key: Optional[str] = None,
    draft_id: Optional[str] = None,
) -> Optional[str]:
    """
    Extrae la clave de idempotencia en orden de prioridad:
    1. Header HTTP 'Idempotency-Key'
    2. Header HTTP 'X-Idempotency-Key'
    3. Campo payload_key
    4. draft_id formateado como 'draft:{draft_id}'
    """
    header_key = None
    if request:
        header_key = request.headers.get("Idempotency-Key") or request.headers.get("X-Idempotency-Key")
        if header_key:
            header_key = str(header_key).strip()

    if header_key:
        return header_key
    if payload_key and str(payload_key).strip():
        return str(payload_key).strip()
    if draft_id and str(draft_id).strip():
        return f"draft:{str(draft_id).strip()}"
    return None


def build_idempotency_scope(endpoint: str, user_id: Optional[str], resource_id: Optional[str] = None) -> str:
    """Construye un ámbito único para la clave de idempotencia."""
    parts = [str(endpoint).strip("/")]
    if user_id:
        parts.append(str(user_id))
    if resource_id:
        parts.append(str(resource_id))
    return ":".join(parts)


async def ensure_idempotency_indexes(db: Any) -> None:
    """Crea índices con TTL de 24 horas y unicidad en la colección de idempotencia."""
    if db is None:
        return
    try:
        col = getattr(db, "idempotency_records", None)
        if col is not None:
            await col.create_index(
                [("scope", 1), ("key", 1)],
                unique=True,
                name="idx_idempotency_scope_key",
            )
            # TTL automático de 24 horas (86400 segundos)
            await col.create_index(
                "created_at",
                expireAfterSeconds=86400,
                name="idx_idempotency_ttl",
            )
            logger.info("Índices de idempotencia verificados con TTL 24h.")
    except Exception as exc:
        logger.warning("No se pudieron inicializar índices de idempotencia: %s", exc)


async def check_idempotency(
    db: Any,
    scope: str,
    key: str,
) -> Tuple[bool, Optional[Dict[str, Any]]]:
    """
    Verifica si una operación ya fue ejecutada.
    Retorna (is_completed, cached_response_data).
    Lanza HTTPException(409) si la operación está actualmente en curso.
    """
    if not key:
        return False, None

    cache_token = f"{scope}:{key}"

    # Verificación en caché memoria rápido
    mem = _MEMORY_IDEMPOTENCY_CACHE.get(cache_token)
    if mem:
        status = mem.get("status")
        if status == "completed":
            return True, mem.get("response")
        if status == "in_progress":
            raise HTTPException(
                status_code=409,
                detail="Operación en proceso con la misma clave de idempotencia. Por favor espera unos momentos.",
            )

    # Verificación en MongoDB
    if db is not None:
        try:
            col = getattr(db, "idempotency_records", None)
            if col is not None:
                record = await col.find_one({"scope": scope, "key": key}, {"_id": 0})
                if record:
                    if record.get("status") == "completed":
                        res = record.get("response")
                        _MEMORY_IDEMPOTENCY_CACHE[cache_token] = {
                            "status": "completed",
                            "response": res,
                        }
                        return True, res
                    elif record.get("status") == "in_progress":
                        # Verificar si lleva más de 30 segundos trabado
                        started_at = record.get("created_at")
                        if isinstance(started_at, datetime):
                            elapsed = (datetime.now(timezone.utc) - started_at).total_seconds()
                            if elapsed > 30:
                                # Posible crash previo; permitimos reintento
                                await col.delete_one({"scope": scope, "key": key})
                                return False, None
                        raise HTTPException(
                            status_code=409,
                            detail="Operación en proceso con la misma clave de idempotencia.",
                        )
        except HTTPException:
            raise
        except Exception as exc:
            logger.warning("Error consultando idempotency_records: %s", exc)

    return False, None


async def start_idempotency_operation(
    db: Any,
    scope: str,
    key: str,
    user_id: Optional[str] = None,
) -> bool:
    """
    Registra el inicio de una operación con estado 'in_progress'.
    Retorna True si adquirió el derecho a ejecutar, o False si ya existía.
    """
    if not key:
        return True

    cache_token = f"{scope}:{key}"
    _MEMORY_IDEMPOTENCY_CACHE[cache_token] = {
        "status": "in_progress",
        "started_at": datetime.now(timezone.utc),
    }

    if db is not None:
        try:
            col = getattr(db, "idempotency_records", None)
            if col is not None:
                now = datetime.now(timezone.utc)
                doc = {
                    "scope": scope,
                    "key": key,
                    "user_id": user_id,
                    "status": "in_progress",
                    "created_at": now,
                    "updated_at": now,
                }
                await col.insert_one(doc)
                return True
        except Exception as exc:
            # Si hay colisión de índice único, significa que ya existe
            logger.info("Colisión de idempotencia al insertar in_progress: %s", exc)
            return False

    return True


async def complete_idempotency_operation(
    db: Any,
    scope: str,
    key: str,
    response_data: Any,
    status_code: int = 200,
    user_id: Optional[str] = None,
) -> None:
    """Almacena la respuesta final de la operación exitosa para devolverla en reintentos."""
    if not key:
        return

    cache_token = f"{scope}:{key}"
    _MEMORY_IDEMPOTENCY_CACHE[cache_token] = {
        "status": "completed",
        "response": response_data,
        "status_code": status_code,
    }

    if db is not None:
        try:
            col = getattr(db, "idempotency_records", None)
            if col is not None:
                now = datetime.now(timezone.utc)
                await col.update_one(
                    {"scope": scope, "key": key},
                    {
                        "$set": {
                            "status": "completed",
                            "status_code": status_code,
                            "response": response_data,
                            "updated_at": now,
                        },
                        "$setOnInsert": {
                            "user_id": user_id,
                            "created_at": now,
                        },
                    },
                    upsert=True,
                )
        except Exception as exc:
            logger.warning("Error guardando resultado de idempotencia: %s", exc)


async def clear_idempotency_on_failure(
    db: Any,
    scope: str,
    key: str,
) -> None:
    """Si la mutación falló con excepción no controlada, libera la clave para permitir reintento."""
    if not key:
        return

    cache_token = f"{scope}:{key}"
    _MEMORY_IDEMPOTENCY_CACHE.pop(cache_token, None)

    if db is not None:
        try:
            col = getattr(db, "idempotency_records", None)
            if col is not None:
                await col.delete_one({"scope": scope, "key": key, "status": "in_progress"})
        except Exception as exc:
            logger.warning("Error limpiando idempotencia tras fallo: %s", exc)
