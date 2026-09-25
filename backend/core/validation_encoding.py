"""
Módulo de Validación Estricta de Entradas (Input Validation) y Codificación Segura (Output Encoding).
MC-LARENS ERP2 - Fase 2 Seguridad P1 (Top 12 #4 Input Validation + #5 Output Encoding).

Garantías:
1. Input Validation:
   - Valida tipos, rangos numéricos finitos (rechaza NaN/Inf), longitudes máximas y formatos en endpoints tocados:
     - Ventas (`POST /api/sales`): customer_id limpio, items con quantity > 0, unit_price >= 0, notas saneadas.
     - Cobros de caja (`POST /cashier/invoices/{id}/collect`): sesion_id, montos finitos no negativos, referencias y notas limpias.
     - Anulación de factura (`POST /caja/facturas/{id}/anular`): motivo, justificación >= 20 caracteres sin inyecciones.
     - Login PIN (`POST /api/auth/pin/login`): PIN de 4-12 dígitos numéricos estrictos, user_id limpio.
     - Identificadores de URL: sin path traversal (`../`), bytes nulos ni caracteres de control.
2. Output Encoding:
   - Limpieza y sanitización de cadenas salientes contra Cross-Site Scripting reflejado (XSS) y etiquetas HTML activas (<script>, <iframe>, javascript:).
   - Encabezados estrictos de contenido JSON (`Content-Type: application/json; charset=utf-8`, `X-Content-Type-Options: nosniff`).
"""
from __future__ import annotations

import html
import logging
import math
import re
from typing import Any, Dict, List, Optional, Union

try:
    from fastapi import HTTPException
    from fastapi.responses import JSONResponse
except ImportError:
    class HTTPException(Exception):  # type: ignore
        def __init__(self, status_code: int, detail: Any = None):
            self.status_code = status_code
            self.detail = detail
            super().__init__(f"HTTP {status_code}: {detail}")

    class JSONResponse:  # type: ignore
        def __init__(self, content: Any, status_code: int = 200, headers: Optional[Dict[str, str]] = None):
            self.content = content
            self.status_code = status_code
            self.headers = headers or {}
            self.headers["content-type"] = "application/json; charset=utf-8"

logger = logging.getLogger(__name__)

# Regex para etiquetas HTML
HTML_TAG_RE = re.compile(r"<[^>]*>", re.IGNORECASE)
SCRIPT_TAG_RE = re.compile(r"<\s*script[^>]*>.*?<\s*/\s*script\s*>", re.IGNORECASE | re.DOTALL)
DANGEROUS_URI_RE = re.compile(r"javascript\s*:", re.IGNORECASE)
CONTROL_CHARS_RE = re.compile(r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]")
PIN_DIGITS_RE = re.compile(r"^\d{4,12}$")
IDENTIFIER_RE = re.compile(r"^[a-zA-Z0-9_\-\.]{1,128}$")


def strip_html_tags(text: str) -> str:
    """Elimina etiquetas HTML y scripts embebidos de un texto."""
    if not text:
        return ""
    # Primero remover bloques <script>...</script>
    s = SCRIPT_TAG_RE.sub("", text)
    # Luego remover todas las etiquetas HTML restantes
    s = HTML_TAG_RE.sub("", s)
    # Neutralizar pseudo-protocolos javascript:
    s = DANGEROUS_URI_RE.sub("", s)
    return s


def encode_safe_html(text: str) -> str:
    """Codifica caracteres especiales de HTML (&, <, >, \", ') a entidades seguras."""
    if not text:
        return ""
    return html.escape(text, quote=True)


def sanitize_text(
    value: Any,
    max_length: int = 2000,
    strip_tags: bool = True,
    strip_controls: bool = True,
) -> str:
    """
    Sanitiza una cadena de texto eliminando bytes nulos, caracteres de control no imprimibles
    y etiquetas HTML, truncando a la longitud máxima permitida.
    """
    if value is None:
        return ""
    s = str(value)
    # Eliminar bytes nulos
    s = s.replace("\x00", "")
    if strip_controls:
        s = CONTROL_CHARS_RE.sub("", s)
    if strip_tags:
        s = strip_html_tags(s)
    s = s.strip()
    if len(s) > max_length:
        s = s[:max_length].strip()
    return s


def validate_identifier(value: Any, name: str = "id", max_length: int = 128) -> str:
    """
    Valida que un identificador (ID de recurso, sale_id, customer_id, etc.)
    tenga un formato alfanumérico seguro, sin path traversal ni inyecciones.
    """
    if value is None:
        raise HTTPException(status_code=400, detail=f"El campo '{name}' es requerido")
    s = str(value).strip()
    if not s:
        raise HTTPException(status_code=400, detail=f"El campo '{name}' no puede estar vacío")
    if len(s) > max_length:
        raise HTTPException(status_code=400, detail=f"El campo '{name}' excede la longitud máxima ({max_length} caracteres)")
    if ".." in s or "/" in s or "\\" in s or "\x00" in s:
        raise HTTPException(status_code=400, detail=f"El identificador '{name}' contiene caracteres prohibidos")
    if not IDENTIFIER_RE.match(s):
        raise HTTPException(status_code=400, detail=f"El formato del campo '{name}' no es válido")
    return s


def validate_numeric_range(
    value: Any,
    name: str,
    min_val: float = 0.0,
    max_val: Optional[float] = None,
) -> float:
    """Valida que un valor numérico sea finito (no NaN ni infinito) y esté en el rango permitido."""
    try:
        n = float(value)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail=f"El campo '{name}' debe ser un valor numérico")

    if math.isnan(n) or math.isinf(n):
        raise HTTPException(status_code=400, detail=f"El campo '{name}' debe ser un número finito válido")

    if n < min_val:
        raise HTTPException(status_code=400, detail=f"El campo '{name}' no puede ser menor a {min_val}")

    if max_val is not None and n > max_val:
        raise HTTPException(status_code=400, detail=f"El campo '{name}' no puede exceder {max_val}")

    return n


def validate_sale_input(sale_data: Any) -> Dict[str, Any]:
    """
    Valida y sanitiza las entradas para la creación/finalización de venta (`POST /api/sales`).
    Acepta tanto un objeto Pydantic (SaleCreate) como un diccionario estándar.
    """
    data = sale_data.model_dump() if hasattr(sale_data, "model_dump") else (
        sale_data.dict() if hasattr(sale_data, "dict") else dict(sale_data or {})
    )

    customer_id = data.get("customer_id")
    if not customer_id:
        raise HTTPException(status_code=400, detail="El campo 'customer_id' es requerido")
    validated_customer_id = validate_identifier(customer_id, "customer_id", max_length=128)

    items = data.get("items")
    if not isinstance(items, list) or len(items) == 0:
        raise HTTPException(status_code=400, detail="La venta debe contener al menos un producto (items)")
    if len(items) > 500:
        raise HTTPException(status_code=400, detail="La venta no puede contener más de 500 ítems")

    sanitized_items = []
    for idx, item in enumerate(items, 1):
        if not isinstance(item, dict):
            raise HTTPException(status_code=400, detail=f"Ítem #{idx} con formato inválido")
        pid = item.get("product_id")
        if not pid:
            raise HTTPException(status_code=400, detail=f"El ítem #{idx} no tiene 'product_id'")
        clean_pid = validate_identifier(pid, f"items[{idx}].product_id", max_length=128)

        qty = item.get("quantity")
        try:
            qty_num = int(qty)
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail=f"Cantidad inválida en ítem #{idx}")
        if qty_num <= 0:
            raise HTTPException(status_code=400, detail=f"La cantidad en ítem #{idx} debe ser mayor a 0")
        if qty_num > 100_000:
            raise HTTPException(status_code=400, detail=f"La cantidad en ítem #{idx} excede el máximo permitido")

        unit_price = validate_numeric_range(
            item.get("unit_price", 0.0),
            f"items[{idx}].unit_price",
            min_val=0.0,
            max_val=10_000_000.0,
        )
        item_discount = validate_numeric_range(
            item.get("discount", 0.0),
            f"items[{idx}].discount",
            min_val=0.0,
            max_val=10_000_000.0,
        )

        clean_item = dict(item)
        clean_item["product_id"] = clean_pid
        clean_item["quantity"] = qty_num
        clean_item["unit_price"] = unit_price
        clean_item["discount"] = item_discount
        if "description" in clean_item:
            clean_item["description"] = sanitize_text(clean_item["description"], max_length=500)
        sanitized_items.append(clean_item)

    discount = validate_numeric_range(
        data.get("discount", 0.0),
        "discount",
        min_val=0.0,
        max_val=10_000_000.0,
    )

    clean_notes = sanitize_text(data.get("notes"), max_length=2000)
    clean_delivery_addr = sanitize_text(data.get("delivery_address"), max_length=500)

    clean_data = dict(data)
    clean_data["customer_id"] = validated_customer_id
    clean_data["items"] = sanitized_items
    clean_data["discount"] = discount
    clean_data["notes"] = clean_notes or None
    clean_data["delivery_address"] = clean_delivery_addr or None

    return clean_data


def validate_cashier_collect_input(payload: Any) -> Dict[str, Any]:
    """
    Valida y sanitiza las entradas para el cobro de factura en caja (`POST /cashier/invoices/{id}/collect`).
    """
    data = payload.model_dump() if hasattr(payload, "model_dump") else (
        payload.dict() if hasattr(payload, "dict") else dict(payload or {})
    )

    sesion_id = data.get("sesion_id") or data.get("session_id")
    if not sesion_id:
        raise HTTPException(status_code=400, detail="El campo 'sesion_id' es requerido")
    clean_sesion_id = validate_identifier(sesion_id, "sesion_id", max_length=128)

    amount = validate_numeric_range(
        data.get("amount", 0.0),
        "amount",
        min_val=0.0,
        max_val=10_000_000.0,
    )

    clean_reference = sanitize_text(data.get("reference") or data.get("referencia_bancaria"), max_length=256)
    clean_notes = sanitize_text(data.get("notes") or data.get("notas"), max_length=2000)

    clean_data = dict(data)
    clean_data["sesion_id"] = clean_sesion_id
    clean_data["amount"] = amount
    clean_data["reference"] = clean_reference or None
    clean_data["notes"] = clean_notes or None
    clean_data["allow_partial"] = bool(data.get("allow_partial", False))

    return clean_data


def validate_cashier_cancel_input(payload: Any) -> Dict[str, Any]:
    """
    Valida y sanitiza las entradas para la anulación de factura (`POST /caja/facturas/{id}/anular`).
    """
    data = payload.model_dump() if hasattr(payload, "model_dump") else (
        payload.dict() if hasattr(payload, "dict") else dict(payload or {})
    )

    motivo = sanitize_text(data.get("motivo"), max_length=500)
    if len(motivo) < 3:
        raise HTTPException(status_code=400, detail="El motivo de anulación debe tener al menos 3 caracteres")

    justificacion = sanitize_text(data.get("justificacion_interna"), max_length=2000)
    if len(justificacion) < 20:
        raise HTTPException(status_code=400, detail="La justificación interna debe tener al menos 20 caracteres")

    clean_data = dict(data)
    clean_data["motivo"] = motivo
    clean_data["justificacion_interna"] = justificacion
    if data.get("autorizado_por"):
        clean_data["autorizado_por"] = validate_identifier(data.get("autorizado_por"), "autorizado_por", max_length=128)

    return clean_data


def validate_pin_login_input(payload: Any) -> Dict[str, Any]:
    """
    Valida y sanitiza las entradas para el login por PIN (`POST /api/auth/pin/login`).
    """
    data = payload.model_dump() if hasattr(payload, "model_dump") else (
        payload.dict() if hasattr(payload, "dict") else dict(payload or {})
    )

    pin_raw = str(data.get("pin") or "").strip()
    if not PIN_DIGITS_RE.match(pin_raw):
        raise HTTPException(status_code=400, detail="El PIN debe consistir de 4 a 12 dígitos numéricos")

    clean_data = dict(data)
    clean_data["pin"] = pin_raw

    user_id = data.get("user_id")
    if user_id:
        clean_data["user_id"] = validate_identifier(user_id, "user_id", max_length=128)

    return clean_data


def sanitize_output_for_json(data: Any, max_depth: int = 5) -> Any:
    """
    Recorre recursivamente estructuras de datos salientes y sanitiza cadenas de texto,
    garantizando que ninguna carga útil reflejada contenga scripts ejecutables o inyecciones.
    """
    if max_depth <= 0:
        return data

    if isinstance(data, str):
        # Eliminar scripts y etiquetas activas en cadenas reflejadas
        return strip_html_tags(data.replace("\x00", ""))
    elif isinstance(data, dict):
        return {k: sanitize_output_for_json(v, max_depth - 1) for k, v in data.items()}
    elif isinstance(data, list):
        return [sanitize_output_for_json(item, max_depth - 1) for item in data]
    return data


def build_secure_json_response(
    data: Any,
    status_code: int = 200,
    headers: Optional[Dict[str, str]] = None,
) -> JSONResponse:
    """
    Construye una respuesta JSON segura con Content-Type y cabeceras de seguridad MIME.
    """
    sanitized = sanitize_output_for_json(data)
    resp_headers = dict(headers or {})
    resp_headers["X-Content-Type-Options"] = "nosniff"
    resp_headers["X-Frame-Options"] = "DENY"
    return JSONResponse(
        content=sanitized,
        status_code=status_code,
        headers=resp_headers,
    )
