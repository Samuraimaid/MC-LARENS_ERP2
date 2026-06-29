"""Tests lógicos del helper compartido de ventas E2E."""
from __future__ import annotations

from backend.scripts.e2e_sale_helpers import (
    build_planned_payment_plan,
    build_sale_create_payload,
    compute_sale_total_nio,
)


def test_compute_sale_total_with_iva_and_discount():
    total = compute_sale_total_nio(100, 36.5, discount_percent=5)
    assert total == round(100 * 0.95 * 36.5 * 1.15, 2)


def test_build_sale_payload_includes_locked_plan():
    payload = build_sale_create_payload(
        customer_id="cust_1",
        vehicle_id="veh_1",
        product_id="prod_1",
        unit_price=85,
        payment_method="cash",
        exchange_rate=36.5,
    )
    assert payload["payment_method"] == "cash"
    assert "planned_payment_plan" in payload
    plan = payload["planned_payment_plan"]
    assert plan["mode"] == "cash"
    assert len(plan["lines"]) == 1
    assert plan["lines"][0]["metodo"] == "cash"
    assert plan["lines"][0]["moneda"] == "NIO"
    assert float(plan["lines"][0]["monto_origen"]) == payload["total_amount"]


def test_build_mixed_plan_lines():
    plan = build_planned_payment_plan(
        "mixed",
        1500,
        lines=[
            {"metodo": "cash", "moneda": "NIO", "monto_origen": 1000},
            {"metodo": "card", "moneda": "NIO", "monto_origen": 500},
        ],
    )
    assert plan["mode"] == "mixed"
    assert sum(float(line["monto_origen"]) for line in plan["lines"]) == 1500