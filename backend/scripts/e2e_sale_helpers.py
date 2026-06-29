"""Helpers compartidos para scripts E2E de ventas con plan de cobro obligatorio."""
from __future__ import annotations

from typing import Any, Dict, List, Optional


def round2(value: Any) -> float:
    return round(float(value or 0.0), 2)


def compute_sale_total_nio(unit_price: float, exchange_rate: float, *, discount_percent: float = 0.0) -> float:
    subtotal = float(unit_price) * (1 - float(discount_percent) / 100.0)
    return round2(subtotal * float(exchange_rate) * 1.15)


def build_planned_payment_plan(
    payment_method: str,
    total_nio: float,
    *,
    exchange_rate: float = 36.5,
    lines: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    method = str(payment_method or "cash").strip().lower()
    if lines:
        return {"mode": method if method == "mixed" else method, "lines": lines}
    return {
        "mode": method,
        "lines": [{
            "metodo": method,
            "moneda": "NIO",
            "monto_origen": round2(total_nio),
        }],
    }


def build_mixed_plan_lines(
    total_nio: float,
    splits: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    return [
        {
            "metodo": row["metodo"],
            "moneda": row.get("moneda", "NIO"),
            "monto_origen": round2(row["monto_origen"]),
        }
        for row in splits
    ]


def build_sale_create_payload(
    *,
    customer_id: str,
    vehicle_id: Optional[str],
    product_id: str,
    unit_price: float,
    warehouse_id: str = "wh_main",
    quantity: int = 1,
    with_installation: bool = False,
    discount_percent: float = 0.0,
    supervisor_discount_preapproved: bool = False,
    payment_method: str = "cash",
    mixed_payment_methods: Optional[List[str]] = None,
    exchange_rate: float = 36.5,
    currency: str = "NIO",
    plan_lines: Optional[List[Dict[str, Any]]] = None,
    notes: str = "",
    idempotency_key: str = "",
) -> Dict[str, Any]:
    total_nio = compute_sale_total_nio(unit_price, exchange_rate, discount_percent=discount_percent)
    method = str(payment_method or "cash").strip().lower()
    planned = build_planned_payment_plan(
        method,
        total_nio,
        exchange_rate=exchange_rate,
        lines=plan_lines,
    )
    payload: Dict[str, Any] = {
        "customer_id": customer_id,
        "vehicle_id": vehicle_id,
        "items": [{
            "product_id": product_id,
            "quantity": quantity,
            "discount": 0,
            "unit_price": unit_price,
            "warehouse_id": warehouse_id,
            "with_installation": with_installation,
        }],
        "discount": discount_percent,
        "payment_type": method,
        "payment_method": method,
        "apply_iva": True,
        "iva_rate": 15,
        "currency": currency,
        "exchange_rate": exchange_rate,
        "total_amount": total_nio,
        "planned_payment_plan": planned,
        "notes": notes,
    }
    if supervisor_discount_preapproved:
        payload["supervisor_discount_preapproved"] = True
    if method == "mixed" and mixed_payment_methods:
        payload["mixed_payment_methods"] = mixed_payment_methods
    if idempotency_key:
        payload["idempotency_key"] = idempotency_key
    return payload