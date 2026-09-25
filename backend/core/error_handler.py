"""
Manejo Seguro de Errores e Higiene de Excepciones en Producción.
MC-LARENS ERP2 - S3 (Top 12 API Security #12).

Garantiza que ninguna excepción no controlada exponga tracebacks, nombres de archivos,
rutas de servidor ni volcados de memoria a clientes externos o atacantes.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, Optional

try:
    from fastapi import FastAPI, HTTPException, Request
    from fastapi.responses import JSONResponse
except ImportError:
    import json
    FastAPI = Any  # type: ignore
    Request = Any  # type: ignore

    class JSONResponse:  # type: ignore
        def __init__(self, content: Any = None, status_code: int = 200, headers: Optional[Dict[str, str]] = None):
            self.content = content
            self.status_code = status_code
            self.headers = headers or {}
            self.body = json.dumps(content).encode("utf-8") if content is not None else b"{}"

    class HTTPException(Exception):  # type: ignore
        def __init__(self, status_code: int = 400, detail: Any = None, headers: Optional[Dict[str, str]] = None):
            self.status_code = status_code
            self.detail = detail
            self.headers = headers
            super().__init__(f"HTTP {status_code}: {detail}")

logger = logging.getLogger(__name__)


def build_sanitized_error_payload(
    error_code: str,
    message: str,
    status_code: int = 500,
    path: Optional[str] = None,
    extra_details: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Crea una estructura JSON consistente y limpia sin rastros de traceback."""
    payload: Dict[str, Any] = {
        "error": error_code,
        "message": message,
        "status_code": status_code,
    }
    if path:
        payload["path"] = path
    if extra_details and isinstance(extra_details, dict):
        payload["details"] = extra_details
    return payload


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """
    Captura cualquier excepción imprevista en el servidor.
    Registra el traceback completo de forma interna y segura en los logs de Cloud Run,
    pero devuelve al cliente un JSON sanitizado sin stack trace.
    """
    path = getattr(getattr(request, "url", None), "path", "unknown")
    method = getattr(request, "method", "UNKNOWN")

    # Registro interno detallado para depuración de desarrollo/operaciones
    logger.exception("Unhandled server exception at %s %s: %s", method, path, exc)

    payload = build_sanitized_error_payload(
        error_code="INTERNAL_SERVER_ERROR",
        message="Ha ocurrido un error interno en el servidor. Por favor intente nuevamente.",
        status_code=500,
        path=path,
    )
    return JSONResponse(status_code=500, content=payload)


async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """
    Maneja HTTPExceptions de FastAPI garantizando un payload JSON estructurado.
    """
    path = getattr(getattr(request, "url", None), "path", "unknown")
    detail = getattr(exc, "detail", "Ocurrió un error en la solicitud")
    status_code = getattr(exc, "status_code", 400)
    headers = getattr(exc, "headers", None)

    if isinstance(detail, dict):
        content = detail
        if "status_code" not in content:
            content["status_code"] = status_code
    else:
        error_code = "HTTP_ERROR"
        if status_code == 400:
            error_code = "BAD_REQUEST"
        elif status_code == 401:
            error_code = "UNAUTHORIZED"
        elif status_code == 403:
            error_code = "FORBIDDEN"
        elif status_code == 404:
            error_code = "NOT_FOUND"
        elif status_code == 409:
            error_code = "CONFLICT"
        elif status_code == 422:
            error_code = "VALIDATION_ERROR"
        elif status_code == 429:
            error_code = "RATE_LIMIT_EXCEEDED"

        content = build_sanitized_error_payload(
            error_code=error_code,
            message=str(detail),
            status_code=status_code,
            path=path,
        )

    return JSONResponse(status_code=status_code, content=content, headers=headers)


def register_error_handlers(app: FastAPI) -> None:
    """Registra los manejadores de excepciones en la aplicación FastAPI."""
    if app is None:
        return
    try:
        app.add_exception_handler(Exception, unhandled_exception_handler)
        app.add_exception_handler(HTTPException, http_exception_handler)
        logger.info("Manejadores globales de error (S3 Error Hygiene) registrados exitosamente.")
    except Exception as exc:
        logger.warning("No se pudieron registrar manejadores de error: %s", exc)
