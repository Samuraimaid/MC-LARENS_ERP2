"""PDF pay stub (colilla de pago) generation — letter and mobile layouts."""
from __future__ import annotations

import io
from typing import Any, Dict, Optional

from backend.domains.hr.pay_stub_document import (
    _ascii_safe,
    build_pay_stub_display,
    build_pay_stub_text_lines,
)


def _draw_text_lines_pdf(
    text_lines: list[str],
    *,
    canvas: Any,
    page_width: float,
    page_height: float,
    margin_top: float = 40,
    margin_x: float = 40,
    line_height: float = 13,
    body_size: int = 9,
    title_size: int = 10,
    net_size: int = 11,
) -> None:
    pdf = canvas
    y = page_height - margin_top

    for line in text_lines:
        upper = line.upper()
        if (
            "COMPROBANTE" in upper
            or "MUNDO DE ACCESORIOS" in upper
            or "TOP CAR" in upper
            or "QUINCENA DEL MES" in upper
        ):
            pdf.setFont("Helvetica-Bold" if "COMPROBANTE" in upper else "Helvetica", title_size)
            text_width = pdf.stringWidth(line, pdf._fontname, pdf._fontsize)
            x = max(margin_x, (page_width - text_width) / 2.0)
        elif "NETO A PAGAR" in upper:
            pdf.setFont("Helvetica-Bold", net_size)
            x = margin_x
        elif "TOTAL INGRESOS" in upper or "TOTAL DEDUCCIONES" in upper:
            pdf.setFont("Helvetica-Bold", body_size)
            x = margin_x
        elif line.startswith("INGRESOS") or line.startswith("DEDUCCIONES"):
            pdf.setFont("Helvetica-Bold", body_size)
            x = margin_x
        else:
            pdf.setFont("Helvetica", body_size)
            x = margin_x
        pdf.drawString(x, y, _ascii_safe(line)[:95])
        y -= line_height


def draw_pay_stub_pdf(
    stub: Dict[str, Any],
    *,
    letter: Any,
    canvas: Any,
    user_doc: Optional[Dict[str, Any]] = None,
) -> bytes:
    """Letter-size PDF using the Mundo de Accesorios colilla layout."""
    display = build_pay_stub_display(stub, user_doc)
    text_lines = build_pay_stub_text_lines(display, width=72)

    buffer = io.BytesIO()
    width, height = letter
    pdf = canvas.Canvas(buffer, pagesize=letter, pageCompression=0)
    _draw_text_lines_pdf(
        text_lines,
        canvas=pdf,
        page_width=width,
        page_height=height,
        margin_top=40,
        margin_x=40,
        line_height=13,
        body_size=9,
        title_size=11,
        net_size=12,
    )
    pdf.save()
    buffer.seek(0)
    return buffer.getvalue()


def draw_pay_stub_pdf_mobile(
    stub: Dict[str, Any],
    *,
    canvas: Any,
    user_doc: Optional[Dict[str, Any]] = None,
) -> bytes:
    """Compact single-column receipt PDF (~80mm width) for mobile/WhatsApp sharing."""
    from reportlab.lib.units import mm

    display = build_pay_stub_display(stub, user_doc)
    text_lines = build_pay_stub_text_lines(display, width=40)

    page_width = 80 * mm
    line_height = 11
    margin_top = 14
    margin_x = 8
    page_height = margin_top + (len(text_lines) + 2) * line_height + 20

    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=(page_width, page_height), pageCompression=0)
    _draw_text_lines_pdf(
        text_lines,
        canvas=pdf,
        page_width=page_width,
        page_height=page_height,
        margin_top=margin_top,
        margin_x=margin_x,
        line_height=line_height,
        body_size=7,
        title_size=8,
        net_size=9,
    )
    pdf.save()
    buffer.seek(0)
    return buffer.getvalue()