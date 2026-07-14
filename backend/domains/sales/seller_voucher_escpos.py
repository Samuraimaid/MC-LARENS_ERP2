"""ESC/POS 80mm seller voucher with Code128 barcode (invoice number)."""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple

from backend.domains.sales.voucher_settings import (
    DEFAULT_SELLER_VOUCHER_SETTINGS,
    normalize_seller_voucher_settings,
)

INVOICE_CODE_PATTERN = re.compile(r"^INV-\d{8}-\d{4}$", re.IGNORECASE)
VOUCHER_WIDTH = 64  # Font B condensed on 80mm thermal paper (~17% less vertical paper)
VOUCHER_TOP_FEED_LINES = DEFAULT_SELLER_VOUCHER_SETTINGS["top_feed_lines"]
VOUCHER_BARCODE_MODULE_WIDTH = DEFAULT_SELLER_VOUCHER_SETTINGS["barcode_module_width"]
VOUCHER_BARCODE_PDF_BAR_WIDTH = DEFAULT_SELLER_VOUCHER_SETTINGS["barcode_pdf_bar_width"]
_FONT_DIR = Path(__file__).resolve().parents[2] / "assets" / "fonts"
_SHARE_TECH_MONO = _FONT_DIR / "ShareTechMono-Regular.ttf"
_SHARE_TECH_MONO_REGISTERED = False


@dataclass
class VoucherLine:
    text: str = ""
    bold: bool = False
    bold_label: str = ""
    large: bool = False
    centered: bool = False


def _resolve_voucher_settings(voucher_settings: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    return normalize_seller_voucher_settings(voucher_settings)


def _voucher_texts(settings: Dict[str, Any]) -> Dict[str, str]:
    return settings.get("texts") or DEFAULT_SELLER_VOUCHER_SETTINGS["texts"]


def _section_enabled(settings: Dict[str, Any], key: str) -> bool:
    sections = settings.get("sections") or {}
    return bool(sections.get(key, True))


BREAKDOWN_ROW_SECTION_KEYS = {
    "gross_subtotal": "breakdown_gross_subtotal",
    "line_discount": "breakdown_line_discount",
    "price_discount": "breakdown_price_discount",
    "code_discount": "breakdown_code_discount",
    "global_discount": "breakdown_global_discount",
    "blocked_discount": "breakdown_blocked_discount",
    "subtotal": "breakdown_subtotal",
    "retention": "breakdown_retention",
    "iva": "breakdown_iva",
    "total": "breakdown_total",
}


def _breakdown_row_visible(settings: Dict[str, Any], kind: str) -> bool:
    if not _section_enabled(settings, "breakdown"):
        return False
    section_key = BREAKDOWN_ROW_SECTION_KEYS.get(kind)
    if not section_key:
        return True
    return _section_enabled(settings, section_key)


def _apply_left_margin(text: str, margin_chars: int) -> str:
    margin = max(0, int(margin_chars or 0))
    if margin <= 0:
        return text
    return (" " * margin) + text


def _manual_center_text(text: str, *, width: int) -> str:
    """Space-pad centering for POS drivers that drop ESC/POS align commands."""
    stripped = _clip_line(str(text or "").strip(), width)
    if not stripped:
        return ""
    if len(stripped) >= width:
        return stripped
    pad = max(0, (width - len(stripped)) // 2)
    return (" " * pad) + stripped


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


def _normalize_payment_method_key(method: Any) -> str:
    key = str(method or "").strip().lower()
    aliases = {
        "efectivo": "cash",
        "transferencia": "transfer",
        "tarjeta": "card",
        "credito": "credit",
        "crédito": "credit",
    }
    return aliases.get(key, key or "cash")


def _build_agreed_payment_lines(
    sale: Dict[str, Any],
    *,
    currency: str,
    line_width: int,
) -> List[VoucherLine]:
    plan = sale.get("planned_payment_plan") if isinstance(sale.get("planned_payment_plan"), dict) else None
    plan_lines = list(plan.get("lines") or []) if plan else []
    payment_rows: List[VoucherLine] = []

    if plan_lines:
        for row in plan_lines:
            method = format_payment_method_label(row.get("metodo"))
            plan_currency = normalize_currency_code(row.get("moneda") or currency)
            amount = float(row.get("monto_origen") or 0.0)
            payment_rows.append(
                VoucherLine(_clip_line(f"{method}: {format_voucher_money(amount, plan_currency)}", line_width))
            )
    else:
        method_key = (
            sale.get("payment_method")
            or sale.get("payment_type")
            or (plan.get("mode") if plan else None)
        )
        method_norm = _normalize_payment_method_key(method_key)
        mixed_methods = sale.get("mixed_payment_methods") or sale.get("mixedPaymentMethods") or []

        if method_norm == "mixed" and isinstance(mixed_methods, list) and mixed_methods:
            for raw_method in mixed_methods:
                payment_rows.append(
                    VoucherLine(_clip_line(format_payment_method_label(raw_method), line_width))
                )
        elif method_key:
            method_label = format_payment_method_label(method_key)
            if method_norm == "credit":
                credit_days = sale.get("credit_days")
                if credit_days:
                    payment_rows.append(
                        VoucherLine(_clip_line(f"{method_label} ({int(credit_days)} dias)", line_width))
                    )
                else:
                    payment_rows.append(VoucherLine(_clip_line(method_label, line_width)))
            else:
                net = float(sale.get("net_to_collect") or sale.get("total") or 0)
                if net > 0:
                    payment_rows.append(
                        VoucherLine(
                            _clip_line(f"{method_label}: {format_voucher_money(net, currency)}", line_width)
                        )
                    )
                else:
                    payment_rows.append(VoucherLine(_clip_line(method_label, line_width)))

    if not payment_rows:
        return []

    return [
        VoucherLine(_clip_line("Metodo de pago acordado:", line_width)),
        *payment_rows,
    ]


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


def _format_discount_pct_label(disc_pct: float) -> str:
    if abs(disc_pct - round(disc_pct)) < 0.001:
        return f"{int(round(disc_pct))}%"
    return f"{disc_pct:.1f}%"


def _short_product_label(name: Any, *, limit: int = 18) -> str:
    return _ascii_safe(str(name or "Producto"))[:limit]


def _resolve_voucher_item_original_unit(item: Dict[str, Any], unit_usd: float) -> float:
    try:
        original_usd = float(item.get("original_unit_price") or unit_usd)
    except (TypeError, ValueError):
        original_usd = unit_usd
    if original_usd > unit_usd + 0.0001:
        return original_usd
    return unit_usd


def _format_voucher_item_detail_line(
    *,
    qty: int,
    unit_usd: float,
    item: Dict[str, Any],
    currency: str,
    exchange_rate: float,
    disc_pct: float = 0.0,
    with_installation: bool = False,
    installation_usd: float = 0.0,
) -> str:
    """Show catalog/base unit and line total; avoids duplicate prices when discounted."""
    unit = _convert_item_amount(unit_usd, currency, exchange_rate)
    original_usd = _resolve_voucher_item_original_unit(item, unit_usd)
    original = _convert_item_amount(original_usd, currency, exchange_rate)
    line_total = unit * qty * (1 - disc_pct / 100)
    if with_installation:
        line_total += _convert_item_amount(installation_usd, currency, exchange_rate) * qty

    has_price_discount = original > unit + 0.005
    display_unit = original if has_price_discount else unit

    detail = f"x{qty}  {format_voucher_money(display_unit, currency)}"
    if disc_pct > 0.005:
        detail += f"  -{_format_discount_pct_label(disc_pct)}"
    detail += f"  {format_voucher_money(line_total, currency)}"
    return detail


def _compute_breakdown_rows(sale: Dict[str, Any]) -> Tuple[List[Tuple[str, float, Dict[str, Any]]], str]:
    currency = normalize_currency_code(sale.get("currency"))
    rate = float(sale.get("exchange_rate") or 36.5)
    items = sale.get("items") or []

    gross_subtotal = 0.0
    item_pct_rows: List[Tuple[str, float]] = []
    manual_rows: List[Tuple[str, float]] = []

    for item in items:
        qty = float(item.get("quantity") or 0)
        if qty <= 0:
            continue
        disc_pct = float(item.get("discount") or 0)
        unit_usd = float(item.get("unit_price") or 0)
        original_usd = float(item.get("original_unit_price") or unit_usd)

        unit = _convert_item_amount(unit_usd, currency, rate)
        original = _convert_item_amount(original_usd, currency, rate)

        install = 0.0
        if item.get("with_installation"):
            install_usd = float(item.get("installation_price") or 0)
            install = _convert_item_amount(install_usd, currency, rate) * qty

        gross_subtotal += (original * qty) + install

        pct_discount = original * qty * (disc_pct / 100.0)
        if pct_discount > 0.005:
            short_name = _short_product_label(item.get("product_name"))
            pct_label = _format_discount_pct_label(disc_pct)
            item_pct_rows.append((
                f"Descuento linea {pct_label} ({short_name}):",
                round(pct_discount, 2),
            ))

        manual = max(0.0, (original - unit) * qty * (1 - disc_pct / 100.0))
        if manual > 0.005:
            short_name = _short_product_label(item.get("product_name"))
            manual_rows.append((f"Descuento precio ({short_name}):", round(manual, 2)))

    item_pct_total = round(sum(amount for _, amount in item_pct_rows), 2)
    manual_total = round(sum(amount for _, amount in manual_rows), 2)

    discounts_applied = float(sale.get("discounts_applied_amount") or sale.get("discount") or 0)
    subtotal_stored = float(sale.get("subtotal") or 0)
    subtotal_after_line_discounts = round(max(gross_subtotal - item_pct_total - manual_total, 0.0), 2)
    if subtotal_stored > 0 and abs(subtotal_stored - subtotal_after_line_discounts) <= max(2.0, subtotal_stored * 0.02):
        subtotal_after_line_discounts = round(subtotal_stored, 2)

    code_rows: List[Tuple[str, float]] = []
    code_discount = 0.0
    for entry in sale.get("applied_discounts") or []:
        if not isinstance(entry, dict):
            continue
        entry_type = str(entry.get("type") or "").lower()
        value = float(entry.get("value") or 0)
        amount = 0.0
        if entry_type == "percent":
            amount = subtotal_after_line_discounts * (value / 100.0)
        elif entry_type == "fixed":
            amount = value if currency == "NIO" else value / rate
        amount = round(amount, 2)
        if amount <= 0:
            continue
        code_label = _ascii_safe(str(entry.get("code") or entry.get("name") or "promocional"))[:16]
        code_rows.append((f"Descuento codigo {code_label}:", amount))
        code_discount += amount
    code_discount = round(min(code_discount, discounts_applied), 2)
    global_discount = round(max(discounts_applied - code_discount, 0.0), 2)
    blocked = float(sale.get("discounts_removed_amount") or sale.get("blocked_discounts_amount") or 0)

    subtotal_after = round(max(subtotal_after_line_discounts - discounts_applied, 0.0), 2)

    iva_rate = float(sale.get("iva_rate") or 0)
    iva_pct = round(iva_rate * 100, 2) if iva_rate <= 1 else iva_rate
    retention_rate = float(sale.get("retention_rate") or 0)
    ret_pct = round(retention_rate * 100, 2) if retention_rate <= 1 else retention_rate

    rows: List[Tuple[str, float, Dict[str, Any]]] = []
    has_any_discount = (
        item_pct_total > 0
        or manual_total > 0
        or code_discount > 0
        or global_discount > 0
        or blocked > 0
    )
    if has_any_discount:
        rows.append((
            "Subtotal sin descuentos:",
            round(gross_subtotal, 2),
            {"bold_label": True, "kind": "gross_subtotal"},
        ))

    for label, amount in item_pct_rows:
        rows.append((label, amount, {"negative": True, "bold_label": True, "kind": "line_discount"}))
    for label, amount in manual_rows:
        rows.append((label, amount, {"negative": True, "bold_label": True, "kind": "price_discount"}))
    for label, amount in code_rows:
        rows.append((label, amount, {"negative": True, "bold_label": True, "kind": "code_discount"}))
    if global_discount > 0:
        rows.append((
            "Descuento global:",
            global_discount,
            {"negative": True, "bold_label": True, "kind": "global_discount"},
        ))
    if blocked > 0:
        rows.append((
            "Descuentos removidos por metodo:",
            blocked,
            {"bold_label": True, "kind": "blocked_discount"},
        ))

    delivery_info = sale.get("delivery_info") or {}
    delivery_cost = float(delivery_info.get("delivery_cost") or 0) if delivery_info.get("is_delivery") else 0.0
    if delivery_cost > 0:
        rows.append((
            "Costo de envio:",
            round(delivery_cost, 2),
            {"bold_label": True, "kind": "delivery_cost"},
        ))

    rows.append(("Subtotal:", subtotal_after, {"bold_label": True, "kind": "subtotal"}))

    retention = float(sale.get("retention_amount") or 0)
    if retention > 0:
        rows.append((
            f"Retencion IR ({ret_pct:g}%):",
            retention,
            {"negative": True, "bold_label": True, "kind": "retention"},
        ))

    iva = float(sale.get("iva_amount") or sale.get("tax") or 0)
    rows.append((f"IVA ({iva_pct:g}%):", iva, {"bold_label": True, "kind": "iva"}))

    total = float(sale.get("net_to_collect") or sale.get("total") or 0)
    rows.append(("TOTAL:", total, {"bold": True, "kind": "total"}))
    return rows, currency


def _filter_breakdown_rows(
    settings: Dict[str, Any],
    rows: List[Tuple[str, float, Dict[str, Any]]],
) -> List[Tuple[str, float, Dict[str, Any]]]:
    return [
        row for row in rows
        if _breakdown_row_visible(settings, str((row[2] or {}).get("kind") or ""))
    ]


def build_seller_voucher_lines(
    sale: Dict[str, Any],
    *,
    vehicle: Optional[Dict[str, Any]] = None,
    width: Optional[int] = None,
    voucher_settings: Optional[Dict[str, Any]] = None,
) -> List[VoucherLine]:
    settings = _resolve_voucher_settings(voucher_settings)
    texts = _voucher_texts(settings)
    line_width = int(width or settings.get("chars_per_line") or VOUCHER_WIDTH)

    lines: List[VoucherLine] = []
    invoice_number = normalize_invoice_scan_code(str(sale.get("invoice_number") or ""))
    currency = normalize_currency_code(sale.get("currency"))
    rate = float(sale.get("exchange_rate") or 36.5)

    if _section_enabled(settings, "header_rules"):
        lines.append(VoucherLine("=" * line_width))
    if _section_enabled(settings, "company_name"):
        lines.append(VoucherLine(_clip_line(texts["company_name"], line_width), centered=True))
    if _section_enabled(settings, "subtitle"):
        lines.append(VoucherLine(_clip_line(texts["subtitle"], line_width), centered=True))
    if _section_enabled(settings, "header_rules"):
        lines.append(VoucherLine("=" * line_width))

    if _section_enabled(settings, "invoice_number") and invoice_number:
        lines.append(_label_value_line("Factura: ", invoice_number, width=line_width))
    if _section_enabled(settings, "date"):
        created_label = format_voucher_datetime(sale.get("created_at"))
        if created_label:
            lines.append(_label_value_line("Fecha: ", created_label, width=line_width))

    if _section_enabled(settings, "customer"):
        customer_name = str(sale.get("customer_name") or "").strip()
        if customer_name:
            lines.append(_label_value_line("Cliente: ", _clip_line(customer_name, line_width - 9), width=line_width))

    if vehicle and (_section_enabled(settings, "vehicle") or _section_enabled(settings, "plate")):
        if _section_enabled(settings, "vehicle"):
            vehicle_label = " ".join(
                str(part)
                for part in [vehicle.get("brand"), vehicle.get("model"), vehicle.get("year")]
                if part is not None and str(part).strip()
            ).strip()
            if vehicle_label:
                lines.append(_label_value_line("Vehiculo: ", _clip_line(vehicle_label, line_width - 10), width=line_width))
        if _section_enabled(settings, "plate"):
            plate = vehicle.get("plate_number") or vehicle.get("plate")
            if plate:
                lines.append(_label_value_line("Placa: ", str(plate), width=line_width))

    show_items = _section_enabled(settings, "items")
    breakdown_rows, breakdown_currency = _compute_breakdown_rows(sale)
    visible_breakdown_rows = _filter_breakdown_rows(settings, breakdown_rows)
    show_breakdown = bool(visible_breakdown_rows)
    show_plan = _section_enabled(settings, "payment_plan")
    if show_items or show_breakdown or show_plan:
        lines.append(VoucherLine("-" * line_width))

    if show_items:
        for item in sale.get("items") or []:
            name = str(item.get("product_name") or "Producto")
            if item.get("with_installation"):
                name = f"{name} +INST"
            for wrapped in _wrap_words(name, line_width):
                lines.append(VoucherLine(wrapped))

            qty = int(item.get("quantity") or 0)
            disc_pct = float(item.get("discount") or 0)
            unit_usd = float(item.get("unit_price") or 0)
            install_usd = float(item.get("installation_price") or 0) if item.get("with_installation") else 0.0
            detail = _format_voucher_item_detail_line(
                qty=qty,
                unit_usd=unit_usd,
                item=item,
                currency=currency,
                exchange_rate=rate,
                disc_pct=disc_pct,
                with_installation=bool(item.get("with_installation")),
                installation_usd=install_usd,
            )
            lines.append(VoucherLine(_clip_line(detail, line_width)))

    if show_breakdown:
        if show_items:
            lines.append(VoucherLine("-" * line_width))
        for label, amount, opts in visible_breakdown_rows:
            lines.append(_amount_row(
                label,
                amount,
                breakdown_currency,
                width=line_width,
                negative=bool(opts.get("negative")),
                bold=bool(opts.get("bold")),
                bold_label=bool(opts.get("bold_label")),
            ))

    if show_plan:
        agreed_payment_lines = _build_agreed_payment_lines(sale, currency=currency, line_width=line_width)
        if agreed_payment_lines:
            if show_items or show_breakdown:
                lines.append(VoucherLine("-" * line_width))
            lines.extend(agreed_payment_lines)

    if _section_enabled(settings, "header_rules"):
        lines.append(VoucherLine("=" * line_width))
    return lines


def build_seller_voucher_text_lines(
    sale: Dict[str, Any],
    *,
    vehicle: Optional[Dict[str, Any]] = None,
    width: Optional[int] = None,
    voucher_settings: Optional[Dict[str, Any]] = None,
) -> List[str]:
    return [
        line.text
        for line in build_seller_voucher_lines(
            sale,
            vehicle=vehicle,
            width=width,
            voucher_settings=voucher_settings,
        )
    ]


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


def _escpos_reset_character_size() -> bytes:
    return bytes([0x1D, 0x21, 0x00])


def _escpos_body_font(settings: Dict[str, Any]) -> bytes:
    body_size = int(settings.get("body_font_size") or 6)
    if body_size <= 6:
        return _escpos_reset_character_size() + _escpos_font_b()
    return _escpos_reset_character_size() + _escpos_font_a()


def _render_escpos_line(line: VoucherLine, *, settings: Optional[Dict[str, Any]] = None) -> bytes:
    """Render one voucher line with uniform glyph size (no bold / double-height) for monospace columns."""
    resolved = _resolve_voucher_settings(settings)
    margin = int(resolved.get("left_margin_chars") or 0)
    max_width = max(8, int(resolved.get("chars_per_line") or VOUCHER_WIDTH) - margin)
    plain = _clip_line(line.text, max_width)
    if line.centered:
        centered_text = _manual_center_text(plain, width=max_width)
        if not centered_text:
            return b"\n"
        text = _apply_left_margin(centered_text, margin)
        return text.encode("ascii", "replace") + b"\n"
    text = _apply_left_margin(plain, margin)
    return text.encode("ascii", "replace") + b"\n"


def _escpos_feed_forward(lines: int = 1) -> bytes:
    """ESC d n — advance paper by n lines (more reliable than bare newlines on POS drivers)."""
    count = max(0, min(255, int(lines)))
    if count <= 0:
        return b""
    return bytes([0x1B, 0x64, count])


def _escpos_feed(lines: int = 1) -> bytes:
    return _escpos_feed_forward(lines)


def _escpos_cut() -> bytes:
    return b"\x1d\x56\x00"


def _escpos_code128(invoice_number: str, *, module_width: int = VOUCHER_BARCODE_MODULE_WIDTH) -> bytes:
    code = normalize_invoice_scan_code(invoice_number)
    if not code:
        return b""
    width_byte = max(2, min(6, int(module_width or VOUCHER_BARCODE_MODULE_WIDTH)))
    payload = b"\x1d\x68\x64"
    payload += bytes([0x1D, 0x77, width_byte])
    payload += b"\x1d\x48\x02"
    encoded = code.encode("ascii")
    payload += b"\x1d\x6b\x49" + bytes([len(encoded)]) + encoded
    payload += b"\n"
    return payload


def _is_skipped_voucher_footer_line(
    stripped: str,
    *,
    invoice_number: str,
    texts: Dict[str, str],
) -> bool:
    upper = stripped.upper()
    lower = stripped.lower()
    scan_label = str(texts.get("scan_label") or "").strip()
    footer_valid = str(texts.get("footer_valid") or "").strip()
    footer_disclaimer = str(texts.get("footer_disclaimer") or "").strip()
    legacy_scan = ("ESCANEAR EN CAJA",)
    legacy_footer = (
        "valido hasta cobro en caja",
        "válido hasta cobro en caja",
        "no es factura fiscal",
    )
    if scan_label and upper.startswith(scan_label.upper()):
        return True
    if any(upper.startswith(label) for label in legacy_scan):
        return True
    if invoice_number and upper == invoice_number:
        return True
    if footer_valid and lower == footer_valid.lower():
        return True
    if footer_disclaimer and lower == footer_disclaimer.lower():
        return True
    return lower in legacy_footer


def _append_voucher_footer(
    chunks: List[bytes],
    invoice_number: str,
    *,
    settings: Optional[Dict[str, Any]] = None,
) -> None:
    resolved = _resolve_voucher_settings(settings)
    texts = _voucher_texts(resolved)
    width = int(resolved.get("chars_per_line") or VOUCHER_WIDTH)
    margin = int(resolved.get("left_margin_chars") or 0)
    module_width = int(resolved.get("barcode_module_width") or VOUCHER_BARCODE_MODULE_WIDTH)

    show_scan = _section_enabled(resolved, "scan_label")
    show_barcode = _section_enabled(resolved, "barcode")
    show_footer_valid = _section_enabled(resolved, "footer_valid")
    show_footer_disclaimer = _section_enabled(resolved, "footer_disclaimer")
    if not any((show_scan, show_barcode, show_footer_valid, show_footer_disclaimer)):
        chunks.append(_escpos_feed(3))
        chunks.append(_escpos_cut())
        return

    chunks.append(_render_escpos_line(VoucherLine("-" * max(8, width - margin)), settings=resolved))
    if show_scan:
        scan_text = _clip_line(texts["scan_label"], max(8, width - margin)).strip()
        chunks.append(
            _render_escpos_line(
                VoucherLine(scan_text, centered=True),
                settings=resolved,
            )
        )
    if show_barcode and invoice_number:
        chunks.append(_escpos_code128(invoice_number, module_width=module_width))
        centered_invoice = _manual_center_text(invoice_number, width=max(8, width - margin))
        chunks.append(_apply_left_margin(centered_invoice, margin).encode("ascii", "replace") + b"\n")
    if show_footer_valid:
        chunks.append(
            _render_escpos_line(
                VoucherLine(_clip_line(texts["footer_valid"], max(8, width - margin)), centered=True),
                settings=resolved,
            )
        )
    if show_footer_disclaimer:
        chunks.append(
            _render_escpos_line(
                VoucherLine(_clip_line(texts["footer_disclaimer"], max(8, width - margin)), centered=True),
                settings=resolved,
            )
        )
    chunks.append(_escpos_feed(3))
    chunks.append(_escpos_cut())


def _coerce_voucher_lines(
    sale: Dict[str, Any],
    *,
    vehicle: Optional[Dict[str, Any]] = None,
    text_lines: Optional[Sequence[str]] = None,
    voucher_settings: Optional[Dict[str, Any]] = None,
) -> List[VoucherLine]:
    if text_lines:
        return [VoucherLine(str(line)) for line in text_lines]
    return build_seller_voucher_lines(sale, vehicle=vehicle, voucher_settings=voucher_settings)


def build_seller_voucher_escpos(
    sale: Dict[str, Any],
    *,
    vehicle: Optional[Dict[str, Any]] = None,
    text_lines: Optional[List[str]] = None,
    voucher_settings: Optional[Dict[str, Any]] = None,
) -> bytes:
    settings = _resolve_voucher_settings(voucher_settings)
    texts = _voucher_texts(settings)
    invoice_number = normalize_invoice_scan_code(str(sale.get("invoice_number") or ""))
    body_lines = _coerce_voucher_lines(
        sale,
        vehicle=vehicle,
        text_lines=text_lines,
        voucher_settings=settings,
    )
    top_feed = int(settings.get("top_feed_lines") or VOUCHER_TOP_FEED_LINES)

    chunks: List[bytes] = [
        _escpos_init(),
        _escpos_body_font(settings),
        _escpos_align(0),
        _escpos_feed_forward(top_feed),
    ]
    for line in body_lines:
        stripped = str(line.text).strip()
        if _is_skipped_voucher_footer_line(stripped, invoice_number=invoice_number, texts=texts):
            continue
        chunks.append(_render_escpos_line(line, settings=settings))

    _append_voucher_footer(chunks, invoice_number, settings=settings)
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
    voucher_settings: Optional[Dict[str, Any]] = None,
) -> bytes:
    from reportlab.graphics.barcode import code128
    from reportlab.lib.units import mm as mm_unit
    from reportlab.pdfgen import canvas

    settings = _resolve_voucher_settings(voucher_settings)
    texts = _voucher_texts(settings)
    body_font_size = int(settings.get("body_font_size") or 6)
    title_font_size = int(settings.get("title_font_size") or 7)
    left_margin_chars = int(settings.get("left_margin_chars") or 0)
    barcode_pdf_width = float(settings.get("barcode_pdf_bar_width") or VOUCHER_BARCODE_PDF_BAR_WIDTH)

    width = 80 * mm_unit
    height = 220 * mm_unit
    margin_x = 1.5 * mm_unit + (left_margin_chars * 0.45 * mm_unit)
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=(width, height))
    y = height - (6 * mm_unit)
    invoice_number = normalize_invoice_scan_code(str(sale.get("invoice_number") or ""))
    body_lines = _coerce_voucher_lines(
        sale,
        vehicle=vehicle,
        text_lines=text_lines,
        voucher_settings=settings,
    )
    font_name = _register_share_tech_mono()
    title_texts = {
        _clip_line(texts["company_name"]).strip(),
        _clip_line(texts["subtitle"]).strip(),
    }
    line_height = (body_font_size * 0.38 * mm_unit) + (0.35 * mm_unit)
    title_line_height = (title_font_size * 0.38 * mm_unit) + (0.35 * mm_unit)

    def draw_voucher_line(line: VoucherLine) -> None:
        nonlocal y
        text = _clip_line(line.text)
        stripped = text.strip()
        is_title = stripped in title_texts
        active_size = title_font_size if is_title else body_font_size
        pdf.setFont(font_name, active_size)
        if line.centered or is_title:
            pdf.drawCentredString(width / 2, y, stripped or text)
            y -= title_line_height if is_title else line_height
            return
        pdf.drawString(margin_x, y, text)
        y -= line_height

    for line in body_lines:
        stripped = str(line.text).strip()
        if _is_skipped_voucher_footer_line(stripped, invoice_number=invoice_number, texts=texts):
            continue
        draw_voucher_line(line)

    if _section_enabled(settings, "scan_label") or _section_enabled(settings, "barcode"):
        y -= 2 * mm_unit
    if _section_enabled(settings, "scan_label"):
        pdf.setFont(font_name, title_font_size)
        pdf.drawCentredString(width / 2, y, texts["scan_label"])
        y -= title_line_height + (2 * mm_unit)
    if _section_enabled(settings, "barcode") and invoice_number:
        barcode = code128.Code128(
            invoice_number,
            barHeight=12 * mm_unit,
            barWidth=barcode_pdf_width,
        )
        barcode_x = max(margin_x, (width - barcode.width) / 2)
        barcode.drawOn(pdf, barcode_x, max(18 * mm_unit, y - 16 * mm_unit))
        y -= 20 * mm_unit
        pdf.setFont(font_name, body_font_size)
        pdf.drawCentredString(width / 2, y, invoice_number)
        y -= 8 * mm_unit

    if _section_enabled(settings, "footer_valid"):
        draw_voucher_line(VoucherLine(texts["footer_valid"], centered=True))
    if _section_enabled(settings, "footer_disclaimer"):
        draw_voucher_line(VoucherLine(texts["footer_disclaimer"], centered=True))
    pdf.showPage()
    pdf.save()
    buffer.seek(0)
    return buffer.read()