"""
Validación y Recalculo de Dinero y Montos en Servidor.
MC-LARENS ERP2 - C1 (Top 12 API Security + Endurecimiento Case).

El cliente no es fuente de verdad del dinero. El backend valida o recalcula
estrictamente montos, cantidades, descuentos e impuestos en toda mutación financiera.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, Optional, Tuple
try:
    from fastapi import HTTPException
except ImportError:
    class HTTPException(Exception):  # type: ignore
        def __init__(self, status_code: int = 400, detail: Any = None):
            self.status_code = status_code
            self.detail = detail
            super().__init__(f"HTTP {status_code}: {detail}")

logger = logging.getLogger(__name__)

ROUNDING_TOLERANCE_USD = 0.05
MAX_ITEM_QUANTITY = 10000


def validate_sale_item_money(
    item: Dict[str, Any],
    product_name: Optional[str] = None,
) -> Tuple[int, float, float]:
    """
    Valida y sanitiza cantidades y descuentos de cada línea de venta.
    Retorna (cantidad: int, descuento_pct: float, precio_unitario: float).
    Lanza HTTPException(400) si hay valores corruptos o negativos.
    """
    name_label = product_name or item.get("product_name") or item.get("product_id") or "Ítem"

    # 1. Cantidad
    raw_qty = item.get("quantity")
    try:
        qty = int(raw_qty or 0)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=400,
            detail=f"Cantidad inválida para {name_label}",
        )
    if qty <= 0:
        raise HTTPException(
            status_code=400,
            detail=f"La cantidad debe ser mayor a cero ({name_label})",
        )
    if qty > MAX_ITEM_QUANTITY:
        raise HTTPException(
            status_code=400,
            detail=f"Cantidad excesiva ({qty}) para {name_label}. Máximo permitido: {MAX_ITEM_QUANTITY}",
        )

    # 2. Descuento por ítem
    raw_disc = item.get("discount", 0)
    try:
        disc = float(raw_disc or 0.0)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=400,
            detail=f"Porcentaje de descuento inválido para {name_label}",
        )
    if disc < 0.0:
        raise HTTPException(
            status_code=400,
            detail=f"El descuento no puede ser negativo ({name_label})",
        )
    if disc > 100.0:
        raise HTTPException(
            status_code=400,
            detail=f"El descuento no puede superar el 100% ({name_label})",
        )

    # 3. Precio unitario si viene explícito
    raw_price = item.get("unit_price")
    unit_price = 0.0
    if raw_price is not None:
        try:
            unit_price = float(raw_price)
        except (TypeError, ValueError):
            raise HTTPException(
                status_code=400,
                detail=f"Precio unitario inválido para {name_label}",
            )
        if unit_price < 0.0:
            raise HTTPException(
                status_code=400,
                detail=f"El precio unitario no puede ser negativo ({name_label})",
            )

    return qty, disc, unit_price


def enforce_server_settlement_total(
    expected_total: float,
    submitted_total: Optional[Any],
    settlement_data: Optional[Dict[str, Any]] = None,
    tolerance: float = ROUNDING_TOLERANCE_USD,
) -> float:
    """
    Compara el total esperado por el servidor contra el total reportado por el cliente.
    Si el cliente intentó manipular el total con una discrepancia > tolerance,
    rechaza con HTTP 409 TOTAL_MISMATCH.
    Retorna el total validado del servidor.
    """
    expected = round(float(expected_total or 0.0), 2)
    if submitted_total is None:
        return expected

    try:
        submitted = round(float(submitted_total), 2)
    except (TypeError, ValueError):
        # Si no es un número parseable, prevalece el cálculo del servidor
        return expected

    discrepancy = abs(submitted - expected)
    if discrepancy > tolerance:
        logger.warning(
            "C1 TOTAL_MISMATCH detectado: enviado=%s vs calculado_servidor=%s (diff=%.4f)",
            submitted,
            expected,
            discrepancy,
        )
        raise HTTPException(
            status_code=409,
            detail={
                "error": "TOTAL_MISMATCH",
                "message": "El total enviado no coincide con el cálculo del servidor",
                "expected_total": expected,
                "submitted_total": submitted,
                "settlement": settlement_data or {},
            },
        )

    return expected


def recalculate_item_subtotal(
    unit_price: float,
    quantity: int,
    discount_pct: float = 0.0,
    installation_price: float = 0.0,
) -> float:
    """Calcula con precisión de 2 decimales el subtotal neto de línea."""
    base = unit_price * quantity
    discounted = base * (1.0 - (discount_pct / 100.0))
    total = discounted + (installation_price * quantity)
    return round(total, 2)
