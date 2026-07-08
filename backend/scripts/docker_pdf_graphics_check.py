import io
import json
import logging

from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

from backend.domains.export.pdf_documents import (
    _draw_invoice_traceability_block,
    build_preview_pdf_bytes,
    draw_invoice_letter_pdf,
)

logger = logging.getLogger("pdf_graphics_check")
errors: list[str] = []

block_buffer = io.BytesIO()
block_canvas = canvas.Canvas(block_buffer, pagesize=letter)
try:
    _draw_invoice_traceability_block(
        block_canvas,
        sale_id="sale_test",
        invoice_number="INV-VERIFY-001",
        margin_x=36,
        width=letter[0],
        y=120,
        logger=logger,
    )
    block_canvas.save()
    block_bytes = block_buffer.getvalue()
except Exception as exc:
    errors.append(f"block:{exc}")
    block_bytes = b""

company = {"name": "MC-LARENS", "tax_id": "J1", "address": "Managua"}
currencies = {"NIO": {"symbol": "C$"}, "USD": {"symbol": "US$"}}
full_buffer = io.BytesIO()
full_canvas = canvas.Canvas(full_buffer, pagesize=letter)
try:
    draw_invoice_letter_pdf(
        full_canvas,
        invoice_number="INV-VERIFY-001",
        invoice_date="2026-07-08",
        company=company,
        customer={"name": "Cliente", "tax_id": "J-000"},
        vehicle=None,
        items=[
            {
                "product_name": "Producto con instalacion",
                "quantity": 1,
                "unit_price": 100,
                "discount": 0,
                "subtotal": 100,
                "with_installation": True,
                "installation_type": "optional",
            }
        ],
        currency="NIO",
        iva_rate=15,
        apply_iva=True,
        totals={
            "subtotal": 100,
            "tax": 15,
            "iva_amount": 15,
            "total": 115,
            "total_legal": 115,
            "discount": 0,
            "retention_amount": 0,
            "retention_rate": 0,
        },
        currencies=currencies,
        logger=logger,
        sale_id="sale_test",
    )
    full_canvas.save()
    full_bytes = full_buffer.getvalue()
except Exception as exc:
    errors.append(f"full:{exc}")
    full_bytes = b""

try:
    preview_bytes = build_preview_pdf_bytes(
        preview_kind="invoice_paid",
        company=company,
        currencies=currencies,
        logger=logger,
    )
except Exception as exc:
    errors.append(f"preview:{exc}")
    preview_bytes = b""

print(
    json.dumps(
        {
            "ok": not errors
            and block_bytes.startswith(b"%PDF")
            and full_bytes.startswith(b"%PDF")
            and preview_bytes.startswith(b"%PDF")
            and len(full_bytes) > 5000,
            "errors": errors,
            "block_bytes": len(block_bytes),
            "full_bytes": len(full_bytes),
            "preview_bytes": len(preview_bytes),
        }
    )
)