"""PATCH /sales/{id}/payment-plan integration tests."""

from __future__ import annotations

import os

import pytest
import requests

BASE_URL = os.environ.get("BASE_URL", os.environ.get("REACT_APP_BACKEND_URL", "http://127.0.0.1:8001")).rstrip("/")
GERENCIA_PIN = os.environ.get("TEST_GERENCIA_PIN", "01011990")
VENTAS_PIN = os.environ.get("TEST_VENTAS_PIN", "55667788")


def _pin_session(pin: str, user_id: str | None = None) -> requests.Session:
    session = requests.Session()
    payload = {"pin": pin}
    if user_id:
        payload["user_id"] = user_id
    response = session.post(f"{BASE_URL}/api/auth/pin/login", json=payload)
    assert response.status_code == 200, response.text
    token = response.json().get("session_token")
    if token:
        session.cookies.set("session_token", token)
    return session


def _find_pin_user(role: str, auth_session: requests.Session) -> dict | None:
    response = auth_session.get(f"{BASE_URL}/api/auth/pin/users")
    if response.status_code != 200:
        return None
    for user in response.json():
        if str(user.get("role") or "").lower() == role:
            return user
    return None


def _create_pending_cash_sale(ventas_session: requests.Session, gerencia_session: requests.Session) -> dict:
    customers = gerencia_session.get(f"{BASE_URL}/api/customers")
    products = gerencia_session.get(f"{BASE_URL}/api/products")
    vehicles = gerencia_session.get(f"{BASE_URL}/api/vehicles")
    inventory = gerencia_session.get(f"{BASE_URL}/api/inventory")
    rate_doc = gerencia_session.get(f"{BASE_URL}/api/currencies/usd-nio-effective")
    assert customers.status_code == 200
    assert products.status_code == 200
    assert vehicles.status_code == 200
    assert inventory.status_code == 200
    assert rate_doc.status_code == 200, rate_doc.text

    rate = float(rate_doc.json().get("rate") or 36.5)
    stock = {}
    for row in inventory.json():
        if str(row.get("warehouse_id") or "") != "wh_main":
            continue
        pid = row.get("product_id")
        stock[pid] = stock.get(pid, 0) + float(row.get("quantity") or 0)

    vehicle_by_customer = {}
    for vehicle in vehicles.json():
        cid = vehicle.get("customer_id")
        if cid:
            vehicle_by_customer.setdefault(cid, []).append(vehicle)

    natural_types = {"", "natural", "persona", "persona_natural", "individual"}
    customer = next(
        (
            row for row in customers.json()
            if vehicle_by_customer.get(row.get("customer_id"))
            and str(row.get("customer_type") or "natural").lower() in natural_types
        ),
        None,
    )
    if not customer:
        pytest.skip("No customer with vehicle")

    product_rows = sorted(
        [
            row for row in products.json()
            if row.get("product_type") != "service" and stock.get(row.get("product_id"), 0) >= 1
        ],
        key=lambda row: stock.get(row.get("product_id"), 0),
        reverse=True,
    )
    if not product_rows:
        pytest.skip("Insufficient stock for payment plan patch test")

    vehicle = vehicle_by_customer[customer["customer_id"]][0]
    product = product_rows[0]
    unit_price = float(product.get("price") or 0)
    total_nio = round(unit_price * rate * 1.15, 2)

    payload = {
        "customer_id": customer["customer_id"],
        "vehicle_id": vehicle.get("vehicle_id") or vehicle.get("id"),
        "items": [
            {
                "product_id": product["product_id"],
                "quantity": 1,
                "discount": 0,
                "unit_price": unit_price,
                "warehouse_id": "wh_main",
                "with_installation": False,
            }
        ],
        "discount": 0,
        "payment_type": "cash",
        "payment_method": "cash",
        "apply_iva": True,
        "iva_rate": 15,
        "currency": "NIO",
        "exchange_rate": rate,
        "total_amount": total_nio,
        "planned_payment_plan": {
            "mode": "cash",
            "lines": [{"metodo": "cash", "moneda": "NIO", "monto_origen": total_nio}],
        },
    }
    response = ventas_session.post(f"{BASE_URL}/api/sales", json=payload)
    assert response.status_code == 200, response.text
    return response.json()


@pytest.fixture(scope="module")
def gerencia_session():
    return _pin_session(GERENCIA_PIN)


@pytest.fixture(scope="module")
def ventas_session(gerencia_session):
    ventas_user = _find_pin_user("ventas", gerencia_session)
    if not ventas_user:
        pytest.skip("No ventas pin user")
    return _pin_session(VENTAS_PIN, user_id=ventas_user.get("user_id"))


class TestPaymentPlanPatchApi:
    def test_gerencia_can_update_locked_plan(self, gerencia_session, ventas_session):
        sale = _create_pending_cash_sale(ventas_session, gerencia_session)
        sale_id = sale["sale_id"]
        target = float(sale.get("net_to_collect") or sale.get("total") or 0)
        assert target > 0

        new_plan = {
            "mode": "cash",
            "lines": [{"metodo": "cash", "moneda": "NIO", "monto_origen": target}],
        }
        response = gerencia_session.patch(
            f"{BASE_URL}/api/sales/{sale_id}/payment-plan",
            json={"planned_payment_plan": new_plan, "reason": "Ajuste acordado con cliente en mostrador"},
        )
        assert response.status_code == 200, response.text
        updated = response.json()
        assert updated.get("payment_plan_locked") is True
        assert float(updated["planned_payment_plan"]["planned_total_nio"]) == round(target, 2)

    def test_ventas_blocked_from_payment_plan_patch(self, gerencia_session, ventas_session):
        sale = _create_pending_cash_sale(ventas_session, gerencia_session)
        sale_id = sale["sale_id"]
        target = float(sale.get("net_to_collect") or sale.get("total") or 0)
        response = ventas_session.patch(
            f"{BASE_URL}/api/sales/{sale_id}/payment-plan",
            json={
                "planned_payment_plan": {
                    "mode": "cash",
                    "lines": [{"metodo": "cash", "moneda": "NIO", "monto_origen": target}],
                },
                "reason": "Intento no autorizado de cambio de plan",
            },
        )
        assert response.status_code == 403, response.text

    def test_patch_rejects_plan_mismatch(self, gerencia_session, ventas_session):
        sale = _create_pending_cash_sale(ventas_session, gerencia_session)
        sale_id = sale["sale_id"]
        target = float(sale.get("net_to_collect") or sale.get("total") or 0)
        wrong_total = round(target - 1, 2)
        response = gerencia_session.patch(
            f"{BASE_URL}/api/sales/{sale_id}/payment-plan",
            json={
                "planned_payment_plan": {
                    "mode": "cash",
                    "lines": [{"metodo": "cash", "moneda": "NIO", "monto_origen": wrong_total}],
                },
                "reason": "Prueba de rechazo por desviación del plan",
            },
        )
        assert response.status_code == 409, response.text
        detail = response.json().get("detail") or {}
        if isinstance(detail, dict):
            assert detail.get("error") == "PAYMENT_PLAN_MISMATCH"