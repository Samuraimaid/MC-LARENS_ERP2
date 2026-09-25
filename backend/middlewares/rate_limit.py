"""
Middleware y Lógica de Rate Limiting para PIN y Mutaciones Sensibles.
MC-LARENS ERP2 - S2 (Top 12 API Security #3 + Endurecimiento Case C6).

Protege endpoints críticos contra fuerza bruta y ráfagas no autorizadas:
1. /api/auth/pin/login: Tope estricto de ráfaga (5 req/10s, 20 req/60s).
2. Mutaciones sensibles de inventario y caja: Tope suave de 60 req/min.
Responde con HTTP 429 Too Many Requests y cabecera estándar 'Retry-After'.
"""
from __future__ import annotations

import logging
import time
from collections import defaultdict
from typing import Any, Dict, List, Optional, Tuple

try:
    from starlette.middleware.base import BaseHTTPMiddleware
    from starlette.requests import Request
    from starlette.responses import JSONResponse, Response
except ImportError:
    BaseHTTPMiddleware = object  # type: ignore
    Request = Any  # type: ignore
    JSONResponse = Any  # type: ignore
    Response = Any  # type: ignore

logger = logging.getLogger(__name__)


class SlidingWindowRateLimiter:
    """Rate limiter en memoria de ventana deslizante por clave de cliente."""

    def __init__(self):
        # key -> list of float timestamps
        self._hits: Dict[str, List[float]] = defaultdict(list)

    def is_allowed(
        self,
        key: str,
        max_requests: int,
        window_seconds: int,
        now: Optional[float] = None,
    ) -> Tuple[bool, int, int]:
        """
        Evalúa si la solicitud está permitida.
        Retorna (allowed: bool, remaining: int, retry_after_seconds: int).
        """
        current_time = now if now is not None else time.time()
        window_start = current_time - window_seconds

        timestamps = self._hits[key]
        # Limpiar marcas de tiempo fuera de la ventana
        valid_timestamps = [t for t in timestamps if t > window_start]
        self._hits[key] = valid_timestamps

        count = len(valid_timestamps)
        if count >= max_requests:
            oldest_in_window = valid_timestamps[0]
            retry_after = int(max(1.0, (oldest_in_window + window_seconds) - current_time))
            return False, 0, retry_after

        # Registrar la solicitud actual
        valid_timestamps.append(current_time)
        remaining = max_requests - len(valid_timestamps)
        return True, remaining, 0

    def reset_key(self, key: str) -> None:
        """Limpia el historial de una clave (ej. login exitoso)."""
        self._hits.pop(key, None)

    def clear(self) -> None:
        """Limpia todo el historial."""
        self._hits.clear()


# Instancia global del limitador
limiter = SlidingWindowRateLimiter()

# Configuración de límites
PIN_BURST_MAX = 5
PIN_BURST_WINDOW_SECONDS = 10

PIN_SUSTAINED_MAX = 20
PIN_SUSTAINED_WINDOW_SECONDS = 60

MUTATIONS_MAX = 60
MUTATIONS_WINDOW_SECONDS = 60


def get_client_identifier(request: Request) -> str:
    """Obtiene la IP y señal de cliente/dispositivo (C6) para discriminar tráfico."""
    # 1. IP del cliente respetando proxies Cloud Run / Nginx
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        client_ip = forwarded.split(",")[0].strip()
    elif request.client and request.client.host:
        client_ip = request.client.host.strip()
    else:
        client_ip = "127.0.0.1"

    # 2. Señal de dispositivo o sesión (C6) si existe
    device_sig = (
        request.headers.get("X-Device-Id")
        or request.headers.get("X-Session-Id")
        or request.cookies.get("session_token")
        or ""
    )
    if device_sig:
        # Usar los primeros 16 caracteres para acotar
        return f"{client_ip}:{device_sig[:16]}"
    return client_ip


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Middleware FastAPI/Starlette que intercepta y aplica límites 429."""

    async def dispatch(self, request: Request, call_next) -> Response:
        path = request.url.path
        method = request.method.upper()

        # 1. Rate limiting estricto para PIN Login
        if path == "/api/auth/pin/login" and method == "POST":
            client_id = get_client_identifier(request)

            # A. Verificación de ráfaga (5 en 10s)
            allowed_burst, _, retry_burst = limiter.is_allowed(
                f"pin_burst:{client_id}",
                max_requests=PIN_BURST_MAX,
                window_seconds=PIN_BURST_WINDOW_SECONDS,
            )
            if not allowed_burst:
                logger.warning("Rate limit 429 (burst) en /api/auth/pin/login para %s", client_id)
                return JSONResponse(
                    status_code=429,
                    content={
                        "error": "RATE_LIMIT_EXCEEDED",
                        "message": "Demasiados intentos de acceso en pocos segundos. Por favor espera antes de reintentar.",
                        "retry_after_seconds": retry_burst,
                    },
                    headers={"Retry-After": str(retry_burst)},
                )

            # B. Verificación sostenida (20 en 60s)
            allowed_sustained, _, retry_sustained = limiter.is_allowed(
                f"pin_sustained:{client_id}",
                max_requests=PIN_SUSTAINED_MAX,
                window_seconds=PIN_SUSTAINED_WINDOW_SECONDS,
            )
            if not allowed_sustained:
                logger.warning("Rate limit 429 (sustained) en /api/auth/pin/login para %s", client_id)
                return JSONResponse(
                    status_code=429,
                    content={
                        "error": "RATE_LIMIT_EXCEEDED",
                        "message": "Límite de intentos de PIN excedido por minuto. Por favor espera antes de reintentar.",
                        "retry_after_seconds": retry_sustained,
                    },
                    headers={"Retry-After": str(retry_sustained)},
                )

        # 2. Tope suave para mutaciones sensibles de dinero/inventario (POST/PUT/DELETE)
        elif method in {"POST", "PUT", "DELETE"} and (
            path.startswith("/api/sales")
            or path.startswith("/api/inventory")
            or "/caja/facturas/" in path
            or path == "/api/cashier/invoices"
        ):
            client_id = get_client_identifier(request)
            allowed, _, retry_after = limiter.is_allowed(
                f"mutation:{client_id}",
                max_requests=MUTATIONS_MAX,
                window_seconds=MUTATIONS_WINDOW_SECONDS,
            )
            if not allowed:
                logger.warning("Rate limit 429 en mutación sensible %s para %s", path, client_id)
                return JSONResponse(
                    status_code=429,
                    content={
                        "error": "RATE_LIMIT_EXCEEDED",
                        "message": "Demasiadas operaciones en curso. Por favor espere unos momentos.",
                        "retry_after_seconds": retry_after,
                    },
                    headers={"Retry-After": str(retry_after)},
                )

        return await call_next(request)
