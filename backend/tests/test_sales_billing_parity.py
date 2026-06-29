"""
Sales / cashier billing policy verification tests.
"""

import os

import pytest
import requests

BASE_URL = os.environ.get("BASE_URL", os.environ.get("REACT_APP_BACKEND_URL", "http://127.0.0.1:8001")).rstrip("/")
GERENCIA_PIN = os.environ.get("TEST_GERENCIA_PIN", "01011990")


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
    users = response.json()
    for user in users:
        if str(user.get("role") or "").lower() == role:
            return user
    return None


@pytest.fixture(scope="module")
def gerencia_session():
    return _pin_session(GERENCIA_PIN)


class TestCashierAccessPolicy:
    def test_ventas_blocked_from_caja_facturas(self, gerencia_session):
        import random

        login_pin = f"{random.randint(10**7, 10**8 - 1)}"
        attendance_pin = f"{random.randint(10**3, 10**4 - 1)}"
        create_payload = {
            "name": "TEST_VentasBilling",
            "last_name": "Policy",
            "phone": "8888-9999",
            "role": "ventas",
            "pin": attendance_pin,
            "login_pin": login_pin,
            "branch_id": "branch_main",
        }
        created = gerencia_session.post(f"{BASE_URL}/api/users/pin", json=create_payload)
        assert created.status_code == 200, created.text
        user_id = created.json().get("user_id")
        try:
            ventas_session = _pin_session(login_pin, user_id=user_id)
            response = ventas_session.get(f"{BASE_URL}/api/caja/facturas", params={"tab": "cotizacion"})
            assert response.status_code == 403, response.text
        finally:
            if user_id:
                gerencia_session.delete(f"{BASE_URL}/api/users/pin/{user_id}")

    def test_cashier_tabs_only_four_aliases(self, gerencia_session):
        for tab in ("cotizacion", "credito", "pagadas", "abonos"):
            response = gerencia_session.get(f"{BASE_URL}/api/caja/facturas", params={"tab": tab})
            assert response.status_code == 200, f"tab={tab} failed: {response.text}"

        invalid = gerencia_session.get(f"{BASE_URL}/api/caja/facturas", params={"tab": "anuladas"})
        assert invalid.status_code == 400


class TestPrintPolicy:
    def test_seller_voucher_endpoint_exists(self, gerencia_session):
        sales = gerencia_session.get(f"{BASE_URL}/api/sales")
        assert sales.status_code == 200
        rows = sales.json()
        if not rows:
            pytest.skip("No sales in database")
        sale_id = rows[0]["sale_id"]
        response = gerencia_session.get(f"{BASE_URL}/api/print/seller-voucher/{sale_id}")
        assert response.status_code == 200, response.text
        assert "VOUCHER DE VENTA" in response.text

    def test_invoice_pdf_blocked_before_payment(self, gerencia_session):
        sales = gerencia_session.get(f"{BASE_URL}/api/sales")
        assert sales.status_code == 200
        pending = next(
            (row for row in sales.json() if str(row.get("payment_status") or "").lower() != "paid"),
            None,
        )
        if not pending:
            pytest.skip("No pending sale for invoice-pdf guard test")
        response = gerencia_session.get(f"{BASE_URL}/api/print/invoice-pdf/{pending['sale_id']}")
        assert response.status_code == 403, response.text

    def test_ventas_blocked_from_invoice_pdf(self, gerencia_session):
        import random

        sales = gerencia_session.get(f"{BASE_URL}/api/sales")
        paid = next(
            (row for row in sales.json() if str(row.get("payment_status") or "").lower() == "paid"),
            None,
        )
        if not paid:
            pytest.skip("No paid sale for ventas invoice-pdf test")

        login_pin = f"{random.randint(10**7, 10**8 - 1)}"
        attendance_pin = f"{random.randint(10**3, 10**4 - 1)}"
        create_payload = {
            "name": "TEST_VentasPdf",
            "last_name": "Policy",
            "phone": "8888-9998",
            "role": "ventas",
            "pin": attendance_pin,
            "login_pin": login_pin,
            "branch_id": "branch_main",
        }
        created = gerencia_session.post(f"{BASE_URL}/api/users/pin", json=create_payload)
        assert created.status_code == 200, created.text
        user_id = created.json().get("user_id")
        try:
            ventas_session = _pin_session(login_pin, user_id=user_id)
            response = ventas_session.get(f"{BASE_URL}/api/print/invoice-pdf/{paid['sale_id']}")
            assert response.status_code == 403, response.text
        finally:
            if user_id:
                gerencia_session.delete(f"{BASE_URL}/api/users/pin/{user_id}")


class TestSettlementParity:
    def test_preview_settlement_returns_net_to_collect(self, gerencia_session):
        customers = gerencia_session.get(f"{BASE_URL}/api/customers")
        assert customers.status_code == 200
        company = next(
            (
                row
                for row in customers.json()
                if str(row.get("customer_type") or "").lower() in {"company", "empresa", "juridico", "juridica"}
            ),
            None,
        )
        if not company:
            pytest.skip("No company customer for settlement test")

        payload = {
            "customer_id": company["customer_id"],
            "subtotal": 1000.0,
            "discount_percent": 0,
            "discounts_amount": 0,
            "promotions_amount": 0,
            "payment_method": "cash",
            "print_format": "letter",
            "apply_iva": True,
            "retention_rate_hint": 0.02,
        }
        response = gerencia_session.post(f"{BASE_URL}/api/sales/preview-settlement", json=payload)
        assert response.status_code == 200, response.text
        data = response.json()
        assert "net_to_collect" in data
        assert float(data["retention_amount"]) > 0
        assert abs(float(data["net_to_collect"]) - (float(data["total_legal"]) - float(data["retention_amount"]))) < 0.05


class TestSupervisorPriceSaleToCashier:
    def test_ventas_can_send_nio_sale_after_supervisor_price_edit(self, gerencia_session):
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

        product_rows = [
            row for row in products.json()
            if row.get("product_type") != "service" and stock.get(row.get("product_id"), 0) >= 2
        ]
        if len(product_rows) < 2:
            pytest.skip("Insufficient stock for supervisor price sale test")

        vehicle = vehicle_by_customer[customer["customer_id"]][0]
        chosen = product_rows[:2]
        cart = []
        for product in chosen:
            price = float(product.get("price") or 0)
            cart.append({
                "product_id": product["product_id"],
                "quantity": 1,
                "unit_price": price,
                "original_unit_price": price,
                "discount": 0,
                "warehouse_id": "wh_main",
                "with_installation": False,
            })

        edited_price = round(cart[0]["unit_price"] * 0.9, 6)
        cart[0]["unit_price"] = edited_price

        subtotal_usd = sum(float(item["unit_price"]) * int(item["quantity"]) for item in cart)
        total_nio = round(subtotal_usd * rate * 1.15, 2)

        ventas_user = _find_pin_user("ventas", gerencia_session)
        if not ventas_user:
            pytest.skip("No ventas pin user")

        ventas_session = _pin_session("55667788", user_id=ventas_user.get("user_id"))
        payload = {
            "customer_id": customer["customer_id"],
            "vehicle_id": vehicle.get("vehicle_id") or vehicle.get("id"),
            "items": [
                {
                    "product_id": item["product_id"],
                    "quantity": item["quantity"],
                    "discount": item["discount"],
                    "unit_price": item["unit_price"],
                    "warehouse_id": item["warehouse_id"],
                    "with_installation": False,
                }
                for item in cart
            ],
            "discount": 0,
            "supervisor_discount_preapproved": True,
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
        sale = response.json()
        sale_id = sale.get("sale_id")
        assert sale_id

        cashier_tabs = gerencia_session.get(
            f"{BASE_URL}/api/caja/facturas",
            params={"tab": "cotizacion"},
        )
        assert cashier_tabs.status_code == 200, cashier_tabs.text
        tab_payload = cashier_tabs.json()
        rows = tab_payload.get("rows") if isinstance(tab_payload, dict) else tab_payload
        visible = any(str(row.get("sale_id")) == str(sale_id) for row in (rows or []))
        assert visible, f"Sale {sale_id} not visible in caja cotizacion tab"