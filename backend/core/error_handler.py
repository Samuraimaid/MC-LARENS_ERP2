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


import re

SPANISH_TRANSLATION_RULES = [
    (re.compile(r"^Insufficient inventory( for (.+))?$", re.I), lambda m: f"Inventario insuficiente{' para ' + m.group(2) if m.group(2) else ' en la bodega de origen'}. Revisa las existencias disponibles o elige otra bodega."),
    (re.compile(r"^Insufficient stock( for (.+))?$", re.I), lambda m: f"Stock insuficiente{' para ' + m.group(2) if m.group(2) else ' en la bodega'}. Revisa las existencias disponibles."),
    (re.compile(r"^Out of stock$", re.I), "Producto sin existencias."),
    (re.compile(r"^Product not found$", re.I), "Producto no encontrado."),
    (re.compile(r"^Customer not found$", re.I), "Cliente no encontrado."),
    (re.compile(r"^Vehicle not found$", re.I), "Vehículo no encontrado."),
    (re.compile(r"^Warehouse not found$", re.I), "Bodega no encontrada."),
    (re.compile(r"^Branch not found$", re.I), "Sucursal no encontrada."),
    (re.compile(r"^Supplier not found$", re.I), "Proveedor no encontrado."),
    (re.compile(r"^User not found$", re.I), "Usuario no encontrado."),
    (re.compile(r"^Sale not found$", re.I), "Venta no encontrada."),
    (re.compile(r"^(Work )?Order not found$", re.I), "Orden de trabajo o pedido no encontrado."),
    (re.compile(r"^Quotation not found$", re.I), "Cotización no encontrada."),
    (re.compile(r"^Transfer not found$", re.I), "Traslado no encontrado."),
    (re.compile(r"^Category not found$", re.I), "Categoría no encontrada."),
    (re.compile(r"^Technician not found$", re.I), "Técnico no encontrado."),
    (re.compile(r"^Approval not found$", re.I), "Solicitud de aprobación no encontrada."),
    (re.compile(r"^Notification not found.*$", re.I), "Notificación no encontrada o no permitida."),
    (re.compile(r"^Item not found$", re.I), "Artículo no encontrado."),
    (re.compile(r"^(.+) not found$", re.I), lambda m: f"{m.group(1)} no encontrado(a)."),
    (re.compile(r"^Unauthorized$", re.I), "No autorizado. Inicia sesión para continuar."),
    (re.compile(r"^Forbidden$", re.I), "Acceso denegado. No tienes permisos para esta acción."),
    (re.compile(r"^Invalid session$", re.I), "Tu sesión ha expirado o no es válida. Inicia sesión nuevamente."),
    (re.compile(r"^Invalid (credentials|password|token)$", re.I), "Credenciales o token inválidos. Verifica los datos."),
    (re.compile(r"^SKU already exists.*$", re.I), "El código SKU ya existe en el inventario. Elige otro código o edita el producto."),
    (re.compile(r"^(.+) already exists$", re.I), lambda m: f"{m.group(1)} ya existe en el sistema."),
    (re.compile(r"^Draft id is required$", re.I), "El ID de borrador es requerido."),
    (re.compile(r"^Invalid draft flow$", re.I), "Flujo de borrador no válido."),
    (re.compile(r"^Invalid approval request$", re.I), "Solicitud de aprobación inválida."),
    (re.compile(r"^Invalid edit payload$", re.I), "Datos de edición inválidos."),
    (re.compile(r"^(Missing|Required)( field)?:? (.+)$", re.I), lambda m: f"El campo {m.group(3)} es requerido."),
    (re.compile(r"^Cannot delete (.+)$", re.I), lambda m: f"No se puede eliminar: {m.group(1)}."),
    (re.compile(r"^Cannot (.+)$", re.I), lambda m: f"No se puede realizar la acción: {m.group(1)}."),
    (re.compile(r"^Internal Server Error$", re.I), "Error interno del servidor. Intenta de nuevo."),
    (re.compile(r"^Not Found$", re.I), "Recurso no encontrado."),
    (re.compile(r"^Bad Request$", re.I), "Solicitud incorrecta."),
    (re.compile(r"^Method not allowed$", re.I), "Método no permitido para esta ruta."),
    (re.compile(r"^Payment required$", re.I), "Pago o autorización requerida."),
]


def translate_error_to_spanish(text: str) -> str:
    """Traduce mensajes de error comunes en inglés al español para los colaboradores."""
    if not text or not isinstance(text, str):
        return str(text or "")
    text_clean = text.strip()
    for pattern, repl in SPANISH_TRANSLATION_RULES:
        m = pattern.search(text_clean)
        if m:
            if callable(repl):
                return repl(m)
            return repl
    return text_clean


async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """
    Maneja HTTPExceptions de FastAPI garantizando un payload JSON estructurado y 100% en español.
    """
    path = getattr(getattr(request, "url", None), "path", "unknown")
    detail = getattr(exc, "detail", "Ocurrió un error en la solicitud")
    status_code = getattr(exc, "status_code", 400)
    headers = getattr(exc, "headers", None)

    if isinstance(detail, dict):
        content = detail
        if "detail" in content and isinstance(content["detail"], str):
            content["detail"] = translate_error_to_spanish(content["detail"])
        if "message" in content and isinstance(content["message"], str):
            content["message"] = translate_error_to_spanish(content["message"])
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

        spanish_msg = translate_error_to_spanish(str(detail))
        content = build_sanitized_error_payload(
            error_code=error_code,
            message=spanish_msg,
            status_code=status_code,
            path=path,
        )
        # Ensure detail property is also populated in Spanish for axios client compatibility
        content["detail"] = spanish_msg

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
