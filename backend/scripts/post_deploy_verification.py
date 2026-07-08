"""Post-deploy verification: endpoints, QA suite, letter PDF QR/barcode render."""
from __future__ import annotations

import io
import json
import sys
from typing import Any, Dict

import httpx

BASE = "http://127.0.0.1:8001/api"
PIN_GERENCIA = "01011990"


def _login(client: httpx.Client, pin: str) -> Dict[str, Any]:
    response = client.post(f"{BASE}/auth/pin/login", json={"pin": pin})
    response.raise_for_status()
    return response.json().get("user") or {}


def verify_dual_rates(client: httpx.Client) -> Dict[str, Any]:
    response = client.get(f"{BASE}/currencies/usd-nio-dual")
    return {
        "ok": response.status_code == 200,
        "status": response.status_code,
        "body": response.json() if response.status_code == 200 else response.text[:300],
    }


def verify_warranties_lookup(client: httpx.Client) -> Dict[str, Any]:
    unauth = httpx.Client(timeout=60.0)
    unauth_response = unauth.get(f"{BASE}/warranties/lookup", params={"code": "INV-TEST"})
    unauth.close()

    authed = client.get(f"{BASE}/warranties/lookup", params={"code": ""})
    invalid = client.get(f"{BASE}/warranties/lookup", params={"code": "not-a-valid-scan"})
    return {
        "ok": unauth_response.status_code != 404 and authed.status_code != 404,
        "unauth_status": unauth_response.status_code,
        "empty_code_status": authed.status_code,
        "invalid_code_status": invalid.status_code,
        "route_exists": unauth_response.status_code in {401, 403, 400, 422},
    }


def run_qa_suite(client: httpx.Client) -> Dict[str, Any]:
    response = client.post(f"{BASE}/qa/run-full-simulation-suite")
    if response.status_code != 200:
        return {"ok": False, "status": response.status_code, "body": response.text[:500], "report": {}}
    report = response.json()
    return {
        "ok": bool(report.get("ok")),
        "status": response.status_code,
        "summary": report.get("summary"),
        "errors_count": len(report.get("errors") or []),
        "report": report,
    }


def verify_letter_pdf_graphics(client: httpx.Client, qa_report: Dict[str, Any]) -> Dict[str, Any]:
    import logging

    from backend.domains.export.pdf_documents import (
        _draw_invoice_traceability_block,
        build_preview_pdf_bytes,
        draw_invoice_letter_pdf,
    )
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen import canvas

    logger = logging.getLogger("post_deploy_verification")
    local_errors: list[str] = []

    # 1) Isolated Code128 + QR block (ReportLab graphics stack)
    block_buffer = io.BytesIO()
    block_canvas = canvas.Canvas(block_buffer, pagesize=letter)
    try:
        _draw_invoice_traceability_block(
            block_canvas,
            sale_id="sale_qa_verify_001",
            invoice_number="INV-20260708-VERIFY",
            margin_x=36.0,
            width=letter[0],
            y=120.0,
            logger=logger,
        )
        block_canvas.save()
        block_bytes = block_buffer.getvalue()
    except Exception as exc:
        local_errors.append(f"traceability_block: {exc}")
        block_bytes = b""

    # 2) Full letter invoice with sale_id (footer traceability path)
    company = {"name": "MC-LARENS QA", "tax_id": "J000000000", "address": "Managua"}
    currencies = {"NIO": {"symbol": "C$"}, "USD": {"symbol": "US$"}}
    sample_items = [
        {
            "product_name": "Producto QA + Instalacion",
            "quantity": 1,
            "unit_price": 3715.0,
            "discount": 0,
            "subtotal": 3715.0,
            "with_installation": True,
            "installation_type": "optional",
        }
    ]
    sample_totals = {
        "subtotal": 3715.0,
        "tax": 557.25,
        "iva_amount": 557.25,
        "total": 4272.25,
        "total_legal": 4272.25,
        "discount": 0,
        "retention_amount": 0,
        "retention_rate": 0,
    }
    full_buffer = io.BytesIO()
    full_canvas = canvas.Canvas(full_buffer, pagesize=letter)
    try:
        draw_invoice_letter_pdf(
            full_canvas,
            invoice_number="INV-20260708-VERIFY",
            invoice_date="2026-07-08T12:00:00",
            company=company,
            customer={"name": "Cliente Verificacion", "tax_id": "J-00000000-0"},
            vehicle=None,
            items=sample_items,
            currency="NIO",
            iva_rate=15,
            apply_iva=True,
            totals=sample_totals,
            currencies=currencies,
            logger=logger,
            sale_id="sale_qa_verify_001",
        )
        full_canvas.save()
        full_bytes = full_buffer.getvalue()
    except Exception as exc:
        local_errors.append(f"letter_invoice: {exc}")
        full_bytes = b""

    # 3) Built-in preview generator (settings path used in producción)
    try:
        preview_bytes = build_preview_pdf_bytes(
            preview_kind="invoice_paid",
            company=company,
            currencies=currencies,
            logger=logger,
        )
    except Exception as exc:
        local_errors.append(f"preview_pdf: {exc}")
        preview_bytes = b""

    # 4) Live API PDF from última venta empresa de la suite
    api_bytes = 0
    api_status = None
    transactions = qa_report.get("transactions") if isinstance(qa_report, dict) else None
    company_sale = None
    if isinstance(transactions, list):
        for row in transactions:
            if row.get("apply_iva") and row.get("sale_id"):
                company_sale = row
                break
    if company_sale:
        live = client.get(f"{BASE}/print/invoice-pdf/{company_sale['sale_id']}")
        api_status = live.status_code
        if live.status_code == 200:
            api_bytes = len(live.content or b"")
        else:
            local_errors.append(f"api_pdf: {live.status_code} {live.text[:200]}")

    ok = (
        not local_errors
        and block_bytes.startswith(b"%PDF")
        and full_bytes.startswith(b"%PDF")
        and preview_bytes.startswith(b"%PDF")
        and len(full_bytes) > 5000
        and (api_bytes == 0 or api_bytes > 10000)
    )
    return {
        "ok": ok,
        "errors": local_errors,
        "block_pdf_bytes": len(block_bytes),
        "full_pdf_bytes": len(full_bytes),
        "preview_pdf_bytes": len(preview_bytes),
        "api_pdf_status": api_status,
        "api_pdf_bytes": api_bytes,
        "api_sale_id": (company_sale or {}).get("sale_id"),
    }


def main() -> int:
    report: Dict[str, Any] = {"checks": {}}
    client = httpx.Client(timeout=600.0, follow_redirects=True)

    try:
        _login(client, PIN_GERENCIA)
        report["checks"]["dual_rates"] = verify_dual_rates(client)
        report["checks"]["warranties_lookup"] = verify_warranties_lookup(client)
        qa_result = run_qa_suite(client)
        report["checks"]["qa_suite"] = {
            key: value for key, value in qa_result.items() if key != "report"
        }
        report["checks"]["letter_pdf_graphics"] = verify_letter_pdf_graphics(
            client,
            qa_result.get("report") or {},
        )
        report["ok"] = all(check.get("ok") for check in report["checks"].values())
    finally:
        client.close()

    print(json.dumps(report, indent=2, ensure_ascii=False))
    return 0 if report.get("ok") else 1


if __name__ == "__main__":
    sys.exit(main())