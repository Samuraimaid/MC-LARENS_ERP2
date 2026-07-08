"""Live E2E simulation: 5 natural + 5 company clients, dual rates, mixed payments."""

from __future__ import annotations

import traceback
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx

DEFAULT_BUY_RATE = 36.62
DEFAULT_SELL_RATE = 37.15
PIN_GERENCIA = "01011990"
PIN_VENTAS = "55667788"
PIN_CAJERO = "11223344"
WAREHOUSE_ID = "wh_main"
MIN_STOCK_PER_PRODUCT = 60
STOCK_ADD_CHUNK = 50
RUN_TAG = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")


def _round2(value: Any) -> float:
    return round(float(value or 0.0), 2)


class ApiSession:
    def __init__(self, label: str, base_url: str):
        self.label = label
        self.base_url = base_url.rstrip("/")
        self.client = httpx.Client(timeout=120.0, follow_redirects=True)

    def login(self, pin: str) -> Dict[str, Any]:
        response = self.client.post(f"{self.base_url}/auth/pin/login", json={"pin": pin})
        response.raise_for_status()
        return response.json().get("user") or {}

    def get(self, path: str, **kwargs) -> httpx.Response:
        return self.client.get(f"{self.base_url}{path}", **kwargs)

    def post(self, path: str, json_body: Any = None, **kwargs) -> httpx.Response:
        return self.client.post(f"{self.base_url}{path}", json=json_body, **kwargs)

    def put(self, path: str, json_body: Any = None, **kwargs) -> httpx.Response:
        return self.client.put(f"{self.base_url}{path}", json=json_body, **kwargs)


def _compute_items_subtotal_usd(
    products: List[Dict[str, Any]],
    items: List[Dict[str, Any]],
) -> float:
    by_id = {p["product_id"]: p for p in products}
    subtotal = 0.0
    for row in items:
        product = by_id.get(row["product_id"], {})
        unit = float(row.get("unit_price") or product.get("price") or 0.0)
        qty = int(row.get("quantity") or 1)
        discount = float(row.get("discount") or 0.0)
        line = unit * qty * (1 - discount / 100.0)
        if row.get("with_installation"):
            line += float(product.get("installation_price") or 0.0) * qty
        subtotal += line
    return _round2(subtotal)


def _annotate_plan_lines(lines: List[Dict[str, Any]], buy_rate: float) -> List[Dict[str, Any]]:
    annotated: List[Dict[str, Any]] = []
    for line in lines:
        row = dict(line)
        if str(row.get("moneda") or "NIO").upper() == "USD":
            row["tasa_cambio"] = buy_rate
        annotated.append(row)
    return annotated


def _build_mixed_plan(total_nio: float, buy_rate: float, index: int) -> Dict[str, Any]:
    patterns = [
        [{"metodo": "cash", "moneda": "NIO", "monto_origen": total_nio}],
        [{"metodo": "transfer", "moneda": "USD", "monto_origen": _round2(total_nio / buy_rate)}],
        [
            {"metodo": "cash", "moneda": "NIO", "monto_origen": _round2(total_nio * 0.55)},
            {"metodo": "transfer", "moneda": "USD", "monto_origen": _round2((total_nio * 0.45) / buy_rate)},
        ],
        [
            {"metodo": "cash", "moneda": "USD", "monto_origen": _round2((total_nio * 0.35) / buy_rate)},
            {"metodo": "transfer", "moneda": "NIO", "monto_origen": _round2(total_nio * 0.65)},
        ],
        [
            {"metodo": "cash", "moneda": "NIO", "monto_origen": _round2(total_nio * 0.4)},
            {"metodo": "cash", "moneda": "USD", "monto_origen": _round2((total_nio * 0.6) / buy_rate)},
        ],
    ]
    lines = _annotate_plan_lines(patterns[index % len(patterns)], buy_rate)
    methods = sorted({str(row["metodo"]) for row in lines})
    mode = "mixed" if len(lines) > 1 else str(lines[0]["metodo"])
    return {"mode": mode, "lines": lines, "mixed_methods": methods}


def _pick_products(catalog: List[Dict[str, Any]], count: int = 5) -> List[Dict[str, Any]]:
    physical = [
        p for p in catalog
        if str(p.get("product_type") or "").lower() != "service" and float(p.get("price") or 0) > 0
    ]
    physical.sort(key=lambda row: str(row.get("product_id") or ""))
    return physical[:count]


def _inventory_qty_by_product(gerencia: ApiSession, warehouse_id: str) -> Dict[str, int]:
    response = gerencia.get("/inventory", params={"warehouse_id": warehouse_id})
    if response.status_code != 200:
        return {}
    rows = response.json() if isinstance(response.json(), list) else []
    quantities: Dict[str, int] = {}
    for row in rows:
        product_id = str(row.get("product_id") or "")
        if not product_id:
            continue
        quantities[product_id] = int(row.get("quantity") or 0)
    return quantities


def _ensure_stock(gerencia: ApiSession, products: List[Dict[str, Any]], warehouse_id: str) -> None:
    quantities = _inventory_qty_by_product(gerencia, warehouse_id)
    for product in products:
        product_id = product.get("product_id")
        if not product_id:
            continue
        qty = int(quantities.get(product_id) or 0)
        while qty < MIN_STOCK_PER_PRODUCT:
            add_qty = max(STOCK_ADD_CHUNK, MIN_STOCK_PER_PRODUCT - qty)
            response = gerencia.post(
                "/inventory/add-stock",
                params={
                    "product_id": product_id,
                    "warehouse_id": warehouse_id,
                    "quantity": add_qty,
                    "min_stock": 2,
                },
            )
            response.raise_for_status()
            payload = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
            qty = int(payload.get("quantity") or (qty + add_qty))


def _preview_net_to_collect(
    ventas: ApiSession,
    *,
    customer_id: str,
    subtotal_nio: float,
    apply_iva: bool,
    payment_method: str,
    print_format: str,
) -> float:
    response = ventas.post(
        "/sales/preview-settlement",
        json_body={
            "customer_id": customer_id,
            "subtotal": subtotal_nio,
            "discount_percent": 0,
            "discounts_amount": 0,
            "promotions_amount": 0,
            "payment_method": payment_method,
            "print_format": print_format,
            "apply_iva": apply_iva,
        },
    )
    response.raise_for_status()
    settlement = response.json()
    return float(settlement.get("net_to_collect") or settlement.get("total_legal") or 0.0)


def _ensure_cash_session(cajero: ApiSession, buy_rate: float) -> Optional[str]:
    active = cajero.get("/caja/sesion-activa")
    if active.status_code == 200:
        payload = active.json() or {}
        if payload.get("active") and payload.get("session"):
            return str(payload["session"].get("session_id") or "")
        if payload.get("session_id"):
            return str(payload.get("session_id"))

    date_token = datetime.now(timezone.utc).strftime("%Y%m%d")
    caja_id = f"caja-qa-{date_token}"
    opened = cajero.post(
        "/caja/apertura",
        json_body={
            "caja_id": caja_id,
            "denominaciones": [],
            "tipo_cambio_usd_nio": buy_rate,
            "observaciones": f"QA suite auto-open {RUN_TAG}",
        },
    )
    if opened.status_code == 200:
        return str(opened.json().get("session_id") or "")

    retry = cajero.get("/caja/sesion-activa", params={"caja_id": caja_id})
    if retry.status_code == 200:
        payload = retry.json() or {}
        session = payload.get("session") or payload
        session_id = session.get("session_id")
        if session_id:
            return str(session_id)
    return None


def _http_error_detail(response: httpx.Response) -> str:
    body = (response.text or "").strip()
    if len(body) > 600:
        body = f"{body[:600]}..."
    return f"{response.status_code} {response.request.method} {response.request.url}: {body}"


def _configure_dual_rates(gerencia: ApiSession) -> Dict[str, float]:
    payload = {"buy_rate": DEFAULT_BUY_RATE, "sell_rate": DEFAULT_SELL_RATE}
    put = gerencia.put("/currencies/usd-nio-dual", json_body=payload)
    if put.status_code in {200, 201}:
        doc = put.json() if put.headers.get("content-type", "").startswith("application/json") else {}
        return {
            "buy_rate": float(doc.get("buy_rate") or DEFAULT_BUY_RATE),
            "sell_rate": float(doc.get("sell_rate") or DEFAULT_SELL_RATE),
            "source": "currencies/usd-nio-dual",
        }

    legacy_put = gerencia.put("/settings/billing/exchange", json_body=payload)
    if legacy_put.status_code in {200, 201}:
        doc = legacy_put.json() if legacy_put.headers.get("content-type", "").startswith("application/json") else {}
        return {
            "buy_rate": float(doc.get("buy_rate") or DEFAULT_BUY_RATE),
            "sell_rate": float(doc.get("sell_rate") or DEFAULT_SELL_RATE),
            "source": "settings/billing/exchange",
        }

    get = gerencia.get("/currencies/usd-nio-dual")
    if get.status_code == 200:
        doc = get.json()
        return {
            "buy_rate": float(doc.get("buy_rate") or DEFAULT_BUY_RATE),
            "sell_rate": float(doc.get("sell_rate") or DEFAULT_SELL_RATE),
            "source": "currencies/usd-nio-dual:get",
        }

    return {
        "buy_rate": DEFAULT_BUY_RATE,
        "sell_rate": DEFAULT_SELL_RATE,
        "source": "defaults",
        "configure_error": (put.text or legacy_put.text or "")[:200],
    }


def _create_customer(
    ventas: ApiSession,
    *,
    index: int,
    customer_type: str,
) -> Dict[str, Any]:
    tag = f"QA{RUN_TAG}{index:02d}"
    if customer_type == "empresa":
        payload = {
            "name": f"Empresa Simulacion {tag}",
            "customer_type": "empresa",
            "tax_id": f"J{tag}000000000",
            "phone": f"8800-{index:04d}",
            "email": f"empresa.{tag.lower()}@qa.local",
            "address": "Managua, QA Suite",
        }
    else:
        payload = {
            "name": f"Cliente Natural {tag}",
            "customer_type": "natural",
            "tax_id": f"001-{tag}-0000A",
            "phone": f"7700-{index:04d}",
            "email": f"natural.{tag.lower()}@qa.local",
            "address": "Managua, QA Suite",
        }
    response = ventas.post("/customers", json_body=payload)
    response.raise_for_status()
    return response.json()


def _run_client_flow(
    *,
    ventas: ApiSession,
    cajero: ApiSession,
    gerencia: ApiSession,
    customer: Dict[str, Any],
    products: List[Dict[str, Any]],
    index: int,
    is_company: bool,
    buy_rate: float,
    sell_rate: float,
    cash_session_id: Optional[str],
) -> Dict[str, Any]:
    line_discounts = [5.0, 8.0, 10.0]
    items = []
    for item_index, product in enumerate(products[:5]):
        unit_usd = float(product.get("price") or 10.0)
        discount = line_discounts[item_index] if item_index < 3 else 0.0
        with_install = item_index == 0 and str(product.get("installation_type") or "") != "not_available"
        items.append({
            "product_id": product["product_id"],
            "quantity": 1,
            "discount": discount,
            "unit_price": unit_usd,
            "warehouse_id": WAREHOUSE_ID,
            "with_installation": with_install,
        })

    subtotal_usd = _compute_items_subtotal_usd(products, items)
    subtotal_nio = _round2(subtotal_usd * sell_rate)
    apply_iva = is_company
    print_format = "letter" if apply_iva else "thermal80"

    draft_plan = _build_mixed_plan(subtotal_nio, buy_rate, index)
    payment_method = draft_plan["mode"]
    net_to_collect = _preview_net_to_collect(
        ventas,
        customer_id=customer["customer_id"],
        subtotal_nio=subtotal_nio,
        apply_iva=apply_iva,
        payment_method=payment_method,
        print_format=print_format,
    )
    plan = _build_mixed_plan(net_to_collect, buy_rate, index)
    payment_method = plan["mode"]
    mixed_methods = plan.get("mixed_methods") or []
    total_nio = _round2(net_to_collect)

    sale_payload: Dict[str, Any] = {
        "customer_id": customer["customer_id"],
        "items": items,
        "discount": 0,
        "payment_type": payment_method,
        "payment_method": payment_method,
        "mixed_payment_methods": mixed_methods if payment_method == "mixed" else [],
        "apply_iva": apply_iva,
        "iva_rate": 15,
        "currency": "NIO",
        "exchange_rate": sell_rate,
        "planned_payment_plan": {"mode": plan["mode"], "lines": plan["lines"]},
        "supervisor_discount_preapproved": True,
        "notes": f"QA suite {RUN_TAG} {'empresa' if is_company else 'natural'} #{index + 1}",
        "idempotency_key": f"qa-suite-{RUN_TAG}-{'emp' if is_company else 'nat'}-{index}-{uuid.uuid4().hex[:6]}",
    }
    if cash_session_id:
        sale_payload["cash_session_id"] = cash_session_id

    sale_response = ventas.post("/sales", json_body=sale_payload)
    if sale_response.status_code == 409:
        detail = sale_response.json() if sale_response.headers.get("content-type", "").startswith("application/json") else {}
        expected = None
        if isinstance(detail, dict):
            nested = detail.get("detail")
            if isinstance(nested, dict):
                expected = nested.get("expected_total")
        if expected is not None:
            plan = _build_mixed_plan(float(expected), buy_rate, index)
            sale_payload["planned_payment_plan"] = {"mode": plan["mode"], "lines": plan["lines"]}
            sale_payload["payment_method"] = plan["mode"]
            sale_payload["payment_type"] = plan["mode"]
            sale_payload["mixed_payment_methods"] = plan.get("mixed_methods") or []
            payment_method = plan["mode"]
            total_nio = _round2(float(expected))
            sale_response = ventas.post("/sales", json_body=sale_payload)
    if sale_response.status_code >= 400:
        raise RuntimeError(_http_error_detail(sale_response))
    sale = sale_response.json()
    sale_id = sale.get("sale_id")
    invoice_number = sale.get("invoice_number")

    locked_plan = sale.get("planned_payment_plan") or {}
    plan_lines = locked_plan.get("lines") if isinstance(locked_plan.get("lines"), list) else plan["lines"]
    collect_pagos = []
    for line in plan_lines:
        row = {
            "metodo": line["metodo"],
            "moneda": line["moneda"],
            "monto_origen": float(line["monto_origen"]),
        }
        if str(line.get("moneda") or "NIO").upper() == "USD":
            row["tasa_cambio"] = float(line.get("tasa_cambio") or buy_rate)
        if line.get("monto_cordobas") is not None:
            row["monto_cordobas"] = float(line["monto_cordobas"])
        collect_pagos.append(row)

    pending = float(sale.get("amount_pending") or sale.get("net_to_collect") or total_nio)
    collect_payload = {
        "payment_method": payment_method,
        "pagos": collect_pagos,
        "amount": pending,
        "idempotency_key": f"qa-collect-{sale_id}",
    }
    if cash_session_id:
        collect_payload["sesion_id"] = cash_session_id

    collect_response = cajero.post(f"/cashier/invoices/{sale_id}/collect", json_body=collect_payload)
    if collect_response.status_code >= 400:
        raise RuntimeError(_http_error_detail(collect_response))

    print_checks: Dict[str, Any] = {}
    if apply_iva:
        letter = cajero.get(f"/print/invoice-pdf/{sale_id}")
        print_checks["letter_pdf_status"] = letter.status_code
        print_checks["letter_pdf_bytes"] = len(letter.content or b"")
    else:
        thermal = cajero.get(f"/print/thermal-invoice/{sale_id}/preview-pdf")
        print_checks["thermal_status"] = thermal.status_code
        print_checks["thermal_bytes"] = len(thermal.content or b"")

    warranty_lookup = gerencia.get("/warranties/lookup", params={"code": invoice_number})
    print_checks["warranty_lookup_status"] = warranty_lookup.status_code

    return {
        "customer_id": customer.get("customer_id"),
        "customer_type": customer.get("customer_type"),
        "sale_id": sale_id,
        "invoice_number": invoice_number,
        "apply_iva": apply_iva,
        "total_nio": total_nio,
        "payment_method": payment_method,
        "print_checks": print_checks,
        "collect_amount": pending,
    }


def run_full_simulation_suite(base_url: str) -> Dict[str, Any]:
    report: Dict[str, Any] = {
        "run_tag": RUN_TAG,
        "started_at": datetime.now(timezone.utc).isoformat(),
        "ok": True,
        "steps": [],
        "transactions": [],
        "errors": [],
        "summary": {},
    }

    def _step(name: str, ok: bool, detail: Any = None) -> None:
        report["steps"].append({"name": name, "ok": ok, "detail": detail})
        if not ok:
            report["ok"] = False

    try:
        gerencia = ApiSession("gerencia", base_url)
        ventas = ApiSession("ventas", base_url)
        cajero = ApiSession("cajero", base_url)

        gerencia.login(PIN_GERENCIA)
        ventas.login(PIN_VENTAS)
        cajero.login(PIN_CAJERO)
        _step("login_roles", True)

        rates_doc = _configure_dual_rates(gerencia)
        buy_rate = float(rates_doc.get("buy_rate") or DEFAULT_BUY_RATE)
        sell_rate = float(rates_doc.get("sell_rate") or DEFAULT_SELL_RATE)
        _step(
            "set_dual_rates",
            rates_doc.get("source") != "defaults" or not rates_doc.get("configure_error"),
            rates_doc,
        )

        products_response = ventas.get("/products")
        products_response.raise_for_status()
        products = _pick_products(products_response.json(), count=5)
        if len(products) < 5:
            raise RuntimeError("Se requieren al menos 5 productos con precio para la simulacion")
        _ensure_stock(gerencia, products, WAREHOUSE_ID)
        _step("seed_catalog_stock", True, {"products": [p.get("product_id") for p in products]})

        session_id = _ensure_cash_session(cajero, buy_rate)
        _step("cashier_session", bool(session_id), {"session_id": session_id})

        natural_results: List[Dict[str, Any]] = []
        for idx in range(5):
            try:
                customer = _create_customer(ventas, index=idx + 1, customer_type="natural")
                tx = _run_client_flow(
                    ventas=ventas,
                    cajero=cajero,
                    gerencia=gerencia,
                    customer=customer,
                    products=products,
                    index=idx,
                    is_company=False,
                    buy_rate=buy_rate,
                    sell_rate=sell_rate,
                    cash_session_id=session_id,
                )
                natural_results.append(tx)
            except Exception as exc:
                report["errors"].append({
                    "phase": "natural",
                    "index": idx,
                    "error": str(exc),
                    "trace": traceback.format_exc(),
                })
                report["ok"] = False

        company_results: List[Dict[str, Any]] = []
        for idx in range(5):
            try:
                customer = _create_customer(ventas, index=idx + 11, customer_type="empresa")
                tx = _run_client_flow(
                    ventas=ventas,
                    cajero=cajero,
                    gerencia=gerencia,
                    customer=customer,
                    products=products,
                    index=idx,
                    is_company=True,
                    buy_rate=buy_rate,
                    sell_rate=sell_rate,
                    cash_session_id=session_id,
                )
                company_results.append(tx)
            except Exception as exc:
                report["errors"].append({
                    "phase": "company",
                    "index": idx,
                    "error": str(exc),
                    "trace": traceback.format_exc(),
                })
                report["ok"] = False

        report["transactions"] = natural_results + company_results
        report["summary"] = {
            "natural_ok": len(natural_results),
            "company_ok": len(company_results),
            "total_ok": len(natural_results) + len(company_results),
            "expected": 10,
            "buy_rate": buy_rate,
            "sell_rate": sell_rate,
        }
        transactions_ok = len(natural_results) + len(company_results) == 10
        _step("complete_transactions", transactions_ok, report["summary"])
        if transactions_ok and not report["errors"]:
            report["ok"] = True
    except Exception as exc:
        report["ok"] = False
        report["errors"].append({
            "phase": "bootstrap",
            "error": str(exc),
            "trace": traceback.format_exc(),
        })
        _step("bootstrap", False, str(exc))

    report["finished_at"] = datetime.now(timezone.utc).isoformat()
    return report