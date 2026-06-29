"""ESC/POS 80mm seller voucher with Code128 barcode (invoice number)."""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple

INVOICE_CODE_PATTERN = re.compile(r"^INV-\d{8}-\d{4}$", re.IGNORECASE)
VOUCHER_WIDTH = 64  # Font B condensed on 80mm thermal paper (~17% less vertical paper)
_FONT_DIR = Path(__file__).resolve().parents[2] / "assets" / "fonts"
_SHARE_TECH_MONO = _FONT_DIR / "ShareTechMono-Regular.ttf"
_SHARE_TECH_MONO_REGISTERED = False


@dataclass
class VoucherLine:
    text: str = ""
    bold: bool = False
    bold_label: str = ""


def normalize_invoice_scan_code(raw: str) -> str:
    value = str(raw or "").strip().upper()
    value = value.replace(" ", "")
    if value.startswith("*") and value.endswith("*"):
        value = value[1:-1].strip()
    return value


def is_valid_invoice_barcode(value: str) -> bool:
    return bool(INVOICE_CODE_PATTERN.match(normalize_invoice_scan_code(value)))


def normalize_currency_code(currency: Any) -> str:
    code = str(currency or "NIO").strip().upper()
    if code in {"USD", "US$"}:
        return "USD"
    if code in {"NIO", "C$"}:
        return "NIO"
    return code


def currency_symbol(currency: Any) -> str:
    return "US$" if normalize_currency_code(currency) == "USD" else "C$"


def format_payment_method_label(method: Any) -> str:
    key = str(method or "cash").lower()
    labels = {
        "cash": "Efectivo",
        "card": "Tarjeta",
        "tarjeta": "Tarjeta",
        "credit": "Credito",
        "credito": "Credito",
        "transfer": "Transferencia",
        "transferencia": "Transferencia",
        "mixed": "Mixto",
    }
    return labels.get(key, key)


def _ascii_safe(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", str(text or ""))
    return normalized.encode("ascii", "ignore").decode("ascii")


def _clip_line(text: str, width: int = VOUCHER_WIDTH) -> str:
    return _ascii_safe(text)[:width]


def format_voucher_money(amount: float, currency: Any = "NIO") -> str:
    safe = float(amount or 0)
    symbol = currency_symbol(currency)
    return f"{symbol} {safe:,.2f}"


def format_voucher_datetime(raw: Any) -> str:
    if not raw:
        return ""
    if isinstance(raw, datetime):
        dt = raw
    else:
        text = str(raw).strip()
        if not text:
            return ""
        dt = datetime.fromisoformat(text.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    try:
        from zoneinfo import ZoneInfo

        local = dt.astimezone(ZoneInfo("America/Managua"))
    except Exception:
        local = dt.astimezone(timezone.utc)
    return local.strftime("%Y-%m-%d %H:%M")


def _wrap_words(text: str, width: int = VOUCHER_WIDTH) -> List[str]:
    words = _ascii_safe(text).split()
    if not words:
        return [""]
    lines: List[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if len(candidate) <= width:
            current = candidate
            continue
        if current:
            lines.append(current)
        while len(word) > width:
            lines.append(word[:width])
            word = word[width:]
        current = word
    if current:
        lines.append(current)
    return lines


def _label_value_line(label: str, value: str, *, width: int = VOUCHER_WIDTH) -> VoucherLine:
    text = f"{label}{value}"
    return VoucherLine(_clip_line(text, width), bold_label=label)


def _amount_row(
    label: str,
    amount: float,
    currency: Any,
    *,
    width: int = VOUCHER_WIDTH,
    negative: bool = False,
    bold: bool = False,
    bold_label: bool = False,
) -> VoucherLine:
    signed = -abs(amount) if negative else amount
    money = format_voucher_money(signed, currency)
    gap = max(1, width - len(label) - len(money))
    text = f"{label}{' ' * gap}{money}"
    return VoucherLine(
        _clip_line(text, width),
        bold=bold,
        bold_label=label if bold_label else "",
    )


def _convert_item_amount(value: float, currency: str, exchange_rate: float) -> float:
    if normalize_currency_code(currency) == "NIO":
        return float(value or 0) * float(exchange_rate or 36.5)
    return float(value or 0)


def _compute_breakdown_rows(sale: Dict[str, Any]) -> Tuple[List[Tuple[str, float, Dict[str, Any]]], str]:
    currency = normalize_currency_code(sale.get("currency"))
    rate = float(sale.get("exchange_rate") or 36.5)
    items = sale.get("items") or []

    manual_entries: List[Tuple[str, float]] = []
    subtotal_without = 0.0
    items_subtotal_current = 0.0

    for item in items:
        qty = float(item.get("quantity") or 0)
        unit_usd = float(item.get("unit_price") or 0)
        original_usd = float(item.get("original_unit_price") or unit_usd)
        disc_pct = float(item.get("discount") or 0)
        factor = 1 - (disc_pct / 100)

        unit = _convert_item_amount(unit_usd, currency, rate)
        original = _convert_item_amount(original_usd, currency, rate)
        line_original = (original * qty * factor)
        line_current = (unit * qty * factor)

        if item.get("with_installation"):
            install_usd = float(item.get("installation_price") or 0)
            install = _convert_item_amount(install_usd, currency, rate) * qty
            line_original += install
            line_current += install

        subtotal_without += line_original
        items_subtotal_current += line_current
        manual = max(0.0, (original - unit) * qty * factor)
        if manual > 0.005:
            manual_entries.append((str(item.get("product_name") or "Producto"), manual))

    discounts_applied = float(sale.get("discounts_applied_amount") or sale.get("discount") or 0)
    manual_total = round(sum(amount for _, amount in manual_entries), 2)
    subtotal_base = float(sale.get("subtotal") or 0)
    if items_subtotal_current > 0 and abs(items_subtotal_current - subtotal_base) > 1.0:
        subtotal_base = round(items_subtotal_current, 2)
    subtotal_after = round(max(subtotal_base - discounts_applied, 0.0), 2)

    code_discount = 0.0
    for entry in sale.get("applied_discounts") or []:
        if not isinstance(entry, dict):
            continue
        entry_type = str(entry.get("type") or "").lower()
        value = float(entry.get("value") or 0)
        if entry_type == "percent":
            base = max(subtotal_without - manual_total, 0.0)
            code_discount += base * (value / 100)
        elif entry_type == "fixed":
            code_discount += value if currency == "NIO" else value / rate
    code_discount = round(min(code_discount, discounts_applied), 2)
    global_discount = round(max(discounts_applied - manual_total - code_discount, 0.0), 2)
    blocked = float(sale.get("discounts_removed_amount") or sale.get("blocked_discounts_amount") or 0)

    iva_rate = float(sale.get("iva_rate") or 0)
    iva_pct = round(iva_rate * 100, 2) if iva_rate <= 1 else iva_rate
    retention_rate = float(sale.get("retention_rate") or 0)
    ret_pct = round(retention_rate * 100, 2) if retention_rate <= 1 else retention_rate

    rows: List[Tuple[str, float, Dict[str, Any]]] = []
    if discounts_applied > 0 or manual_total > 0:
        rows.append((
            "Subtotal sin descuentos:",
            subtotal_without if subtotal_without > 0 else subtotal_base,
            {"bold_label": True},
        ))

    for name, amount in manual_entries:
        short_name = _ascii_safe(name)[:22]
        rows.append((f"Descuento Individual ({short_name}):", amount, {"negative": True, "bold_label": True}))

    if code_discount > 0:
        rows.append(("Descuento Codigos:", code_discount, {"negative": True, "bold_label": True}))
    if global_discount > 0:
        rows.append(("Descuento Global:", global_discount, {"negative": True, "bold_label": True}))
    if blocked > 0:
        rows.append(("Descuentos removidos por metodo:", blocked, {"bold_label": True}))

    rows.append(("Subtotal:", subtotal_after, {"bold_label": True}))

    retention = float(sale.get("retention_amount") or 0)
    if retention > 0:
        rows.append((f"Retencion IR ({ret_pct:g}%):", retention, {"negative": True, "bold_label": True}))

    iva = float(sale.get("iva_amount") or sale.get("tax") or 0)
    rows.append((f"IVA ({iva_pct:g}%):", iva, {"bold_label": True}))

    total = float(sale.get("net_to_collect") or sale.get("total") or 0)
    rows.append(("TOTAL:", total, {"bold": True}))
    return rows, currency


def build_seller_voucher_lines(
    sale: Dict[str, Any],
    *,
    vehicle: Optional[Dict[str, Any]] = None,
    width: int = VOUCHER_WIDTH,
) -> List[VoucherLine]:
    lines: List[VoucherLine] = []
    invoice_number = normalize_invoice_scan_code(str(sale.get("invoice_number") or ""))
    currency = normalize_currency_code(sale.get("currency"))
    rate = float(sale.get("exchange_rate") or 36.5)

    lines.append(VoucherLine("=" * width))
    lines.append(VoucherLine("MUNDO DE ACCESORIOS".center(width), bold=True))
    lines.append(VoucherLine("VOUCHER DE VENTA (NO FISCAL)".center(width), bold=True))
    lines.append(VoucherLine("=" * width))

    if invoice_number:
        lines.append(_label_value_line("Factura: ", invoice_number, width=width))
    created_label = format_voucher_datetime(sale.get("created_at"))
    if created_label:
        lines.append(_label_value_line("Fecha: ", created_label, width=width))

    customer_name = str(sale.get("customer_name") or "").strip()
    if customer_name:
        lines.append(_label_value_line("Cliente: ", _clip_line(customer_name, width - 9), width=width))

    if vehicle:
        vehicle_label = " ".join(
            str(part)
            for part in [vehicle.get("brand"), vehicle.get("model"), vehicle.get("year")]
            if part is not None and str(part).strip()
        ).strip()
        if vehicle_label:
            lines.append(_label_value_line("Vehiculo: ", _clip_line(vehicle_label, width - 10), width=width))
        plate = vehicle.get("plate_number") or vehicle.get("plate")
        if plate:
            lines.append(_label_value_line("Placa: ", str(plate), width=width))

    lines.append(VoucherLine("-" * width))

    for item in sale.get("items") or []:
        name = str(item.get("product_name") or "Producto")
        if item.get("with_installation"):
            name = f"{name} +INST"
        for wrapped in _wrap_words(name, width):
            lines.append(VoucherLine(wrapped))

        qty = int(item.get("quantity") or 0)
        disc_pct = float(item.get("discount") or 0)
        unit = _convert_item_amount(float(item.get("unit_price") or 0), currency, rate)
        line_total = unit * qty * (1 - disc_pct / 100)
        if item.get("with_installation"):
            install_usd = float(item.get("installation_price") or 0)
            line_total += _convert_item_amount(install_usd, currency, rate) * qty
        detail = (
            f"x{qty}  {format_voucher_money(unit, currency)}  "
            f"{format_voucher_money(line_total, currency)}"
        )
        lines.append(VoucherLine(_clip_line(detail, width)))

    lines.append(VoucherLine("-" * width))

    breakdown_rows, breakdown_currency = _compute_breakdown_rows(sale)
    for label, amount, opts in breakdown_rows:
        lines.append(_amount_row(
            label,
            amount,
            breakdown_currency,
            width=width,
            negative=bool(opts.get("negative")),
            bold=bool(opts.get("bold")),
            bold_label=bool(opts.get("bold_label")),
        ))

    lines.append(VoucherLine("-" * width))

    plan = sale.get("planned_payment_plan") if isinstance(sale.get("planned_payment_plan"), dict) else None
    plan_lines = list(plan.get("lines") or []) if plan else []
    if plan_lines:
        for row in plan_lines:
            method = format_payment_method_label(row.get("metodo"))
            plan_currency = normalize_currency_code(row.get("moneda") or currency)
            amount = float(row.get("monto_origen") or 0.0)
            lines.append(VoucherLine(
                _clip_line(f"{method}: {format_voucher_money(amount, plan_currency)}", width),
                bold=True,
            ))

    lines.append(VoucherLine("=" * width))
    return lines


def build_seller_voucher_text_lines(
    sale: Dict[str, Any],
    *,
    vehicle: Optional[Dict[str, Any]] = None,
    width: int = VOUCHER_WIDTH,
) -> List[str]:
    return [line.text for line in build_seller_voucher_lines(sale, vehicle=vehicle, width=width)]


def _escpos_init() -> bytes:
    return b"\x1b\x40"


def _escpos_font_a() -> bytes:
    return bytes([0x1B, 0x4D, 0x00])


def _escpos_font_b() -> bytes:
    return bytes([0x1B, 0x4D, 0x01])


def _escpos_align(mode: int) -> bytes:
    return bytes([0x1B, 0x61, mode & 0x03])


def _escpos_bold(enabled: bool) -> bytes:
    return bytes([0x1B, 0x45, 1 if enabled else 0])


def _render_escpos_line(line: VoucherLine) -> bytes:
    text = _clip_line(line.text)
    if line.bold_label and text.startswith(line.bold_label):
        rest = text[len(line.bold_label):]
        return (
            _escpos_bold(True)
            + line.bold_label.encode("ascii", "replace")
            + _escpos_bold(False)
            + rest.encode("ascii", "replace")
            + b"\n"
        )
    if line.bold:
        return _escpos_bold(True) + text.encode("ascii", "replace") + b"\n" + _escpos_bold(False)
    return text.encode("ascii", "replace") + b"\n"


def _escpos_feed(lines: int = 1) -> bytes:
    return b"\n" * max(0, int(lines))


def _escpos_cut() -> bytes:
    return b"\x1d\x56\x00"


def _escpos_code128(invoice_number: str) -> bytes:
    code = normalize_invoice_scan_code(invoice_number)
    if not code:
        return b""
    payload = b"\x1d\x68\x64"
    payload += b"\x1d\x77\x02"
    payload += b"\x1d\x48\x02"
    encoded = code.encode("ascii")
    payload += b"\x1d\x6b\x49" + bytes([len(encoded)]) + encoded
    payload += b"\n"
    return payload


def _append_voucher_footer(chunks: List[bytes], invoice_number: str, *, width: int = VOUCHER_WIDTH) -> None:
    chunks.append(_render_escpos_line(VoucherLine("-" * width)))
    chunks.append(_escpos_align(1))
    chunks.append(_escpos_bold(True))
    chunks.append(b"ESCANEAR EN CAJA\n")
    chunks.append(_escpos_bold(False))
    if invoice_number:
        chunks.append(_escpos_code128(invoice_number))
        chunks.append(invoice_number.encode("ascii", "replace") + b"\n")
    chunks.append(_escpos_align(0))
    chunks.append(_render_escpos_line(VoucherLine("Valido hasta cobro en caja".center(width))))
    chunks.append(_render_escpos_line(VoucherLine("NO ES FACTURA FISCAL".center(width))))
    chunks.append(_escpos_feed(3))
    chunks.append(_escpos_cut())


def _coerce_voucher_lines(
    sale: Dict[str, Any],
    *,
    vehicle: Optional[Dict[str, Any]] = None,
    text_lines: Optional[Sequence[str]] = None,
) -> List[VoucherLine]:
    if text_lines:
        return [VoucherLine(str(line)) for line in text_lines]
    return build_seller_voucher_lines(sale, vehicle=vehicle)


def build_seller_voucher_escpos(
    sale: Dict[str, Any],
    *,
    vehicle: Optional[Dict[str, Any]] = None,
    text_lines: Optional[List[str]] = None,
) -> bytes:
    invoice_number = normalize_invoice_scan_code(str(sale.get("invoice_number") or ""))
    body_lines = _coerce_voucher_lines(sale, vehicle=vehicle, text_lines=text_lines)

    chunks: List[bytes] = [_escpos_init(), _escpos_font_b(), _escpos_align(0)]
    for line in body_lines:
        stripped = str(line.text).strip()
        if stripped.upper().startswith("ESCANEAR EN CAJA"):
            continue
        if invoice_number and stripped.upper() == invoice_number:
            continue
        if stripped.lower() in {
            "valido hasta cobro en caja",
            "no es factura fiscal",
            "válido hasta cobro en caja",
        }:
            continue
        chunks.append(_render_escpos_line(line))

    _append_voucher_footer(chunks, invoice_number)
    return b"".join(chunks)


def _register_share_tech_mono() -> str:
    global _SHARE_TECH_MONO_REGISTERED
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont

    regular_name = "ShareTechMono"
    if _SHARE_TECH_MONO_REGISTERED:
        return regular_name
    if _SHARE_TECH_MONO.exists():
        pdfmetrics.registerFont(TTFont(regular_name, str(_SHARE_TECH_MONO)))
        _SHARE_TECH_MONO_REGISTERED = True
        return regular_name
    return "Courier"


def build_seller_voucher_preview_pdf(
    sale: Dict[str, Any],
    *,
    vehicle: Optional[Dict[str, Any]] = None,
    text_lines: Optional[List[str]] = None,
) -> bytes:
    from reportlab.graphics.barcode import code128
    from reportlab.lib.units import mm as mm_unit
    from reportlab.pdfgen import canvas

    width = 80 * mm_unit
    height = 220 * mm_unit
    margin_x = 1.5 * mm_unit
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=(width, height))
    y = height - (6 * mm_unit)
    invoice_number = normalize_invoice_scan_code(str(sale.get("invoice_number") or ""))
    body_lines = _coerce_voucher_lines(sale, vehicle=vehicle, text_lines=text_lines)
    font_name = _register_share_tech_mono()

    def draw_voucher_line(line: VoucherLine, *, size: int = 6) -> None:
        nonlocal y
        text = _clip_line(line.text)
        active_size = size + (1 if line.bold else 0)
        if line.bold_label and text.startswith(line.bold_label):
            pdf.setFont(font_name, active_size)
            pdf.drawString(margin_x, y, line.bold_label)
            label_width = pdf.stringWidth(line.bold_label, font_name, active_size)
            pdf.setFont(font_name, size)
            pdf.drawString(margin_x + label_width, y, text[len(line.bold_label):])
        else:
            pdf.setFont(font_name, active_size)
            pdf.drawString(margin_x, y, text)
        y -= (active_size * 0.38 * mm_unit) + (0.35 * mm_unit)

    for line in body_lines:
        stripped = str(line.text).strip()
        if stripped.upper().startswith("ESCANEAR EN CAJA"):
            continue
        if invoice_number and stripped.upper() == invoice_number:
            continue
        if stripped.lower() in {
            "valido hasta cobro en caja",
            "no es factura fiscal",
            "válido hasta cobro en caja",
        }:
            continue
        is_title = stripped in {"MUNDO DE ACCESORIOS", "VOUCHER DE VENTA (NO FISCAL)"}
        draw_voucher_line(line, size=7 if is_title else 6)

    y -= 2 * mm_unit
    pdf.setFont(font_name, 9)
    pdf.drawCentredString(width / 2, y, "ESCANEAR EN CAJA")
    y -= 8 * mm_unit
    if invoice_number:
        barcode = code128.Code128(invoice_number, barHeight=12 * mm_unit, barWidth=0.33)
        barcode_x = max(margin_x, (width - barcode.width) / 2)
        barcode.drawOn(pdf, barcode_x, max(18 * mm_unit, y - 16 * mm_unit))
        y -= 20 * mm_unit
        pdf.setFont(font_name, 7)
        pdf.drawCentredString(width / 2, y, invoice_number)
        y -= 8 * mm_unit

    draw_voucher_line(VoucherLine("Valido hasta cobro en caja"))
    draw_voucher_line(VoucherLine("NO ES FACTURA FISCAL"))
    pdf.showPage()
    pdf.save()
    buffer.seek(0)
    return buffer.read()