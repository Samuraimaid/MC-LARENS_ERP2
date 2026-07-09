"""ESC/POS 80mm thermal invoice (post-payment, no IVA) with change info."""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Sequence

from backend.domains.sales.seller_voucher_escpos import (
    VOUCHER_WIDTH,
    VoucherLine,
    _amount_row,
    _apply_left_margin,
    _clip_line,
    _compute_breakdown_rows,
    _escpos_code128,
    _filter_breakdown_rows,
    _label_value_line,
    _manual_center_text,
    _render_escpos_line,
    _section_enabled,
    _wrap_words,
    build_seller_voucher_preview_pdf,
    format_payment_method_label,
    format_voucher_datetime,
    format_voucher_money,
    normalize_currency_code,
    normalize_invoice_scan_code,
)
from backend.domains.sales.seller_voucher_escpos import (
    _escpos_align,
    _escpos_body_font,
    _escpos_cut,
    _escpos_feed,
    _escpos_feed_forward,
    _escpos_init,
)
from backend.domains.sales.invoice_traceability import build_invoice_qr_payload
from backend.domains.sales.voucher_settings import (
    DEFAULT_THERMAL_INVOICE_SETTINGS,
    normalize_thermal_invoice_settings,
)


def _resolve_settings(voucher_settings: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    return normalize_thermal_invoice_settings(voucher_settings)


def _thermal_texts(settings: Dict[str, Any]) -> Dict[str, str]:
    return settings.get("texts") or DEFAULT_THERMAL_INVOICE_SETTINGS["texts"]


def _convert_item_amount(amount: float, currency: str, rate: float) -> float:
    if normalize_currency_code(currency) == "USD":
        return float(amount or 0)
    return float(amount or 0) * float(rate or 1.0)


def _build_collection_lines(
    sale: Dict[str, Any],
    *,
    settings: Dict[str, Any],
    line_width: int,
) -> List[VoucherLine]:
    summary = sale.get("last_payment_summary") if isinstance(sale.get("last_payment_summary"), dict) else {}
    texts = _thermal_texts(settings)
    currency = normalize_currency_code(sale.get("currency"))
    lines: List[VoucherLine] = []

    show_any = any(
        _section_enabled(settings, key)
        for key in (
            "payment_header",
            "payment_method",
            "amount_collected",
            "received_amount",
            "change_amount",
            "cashier_name",
            "collected_date",
        )
    )
    if not show_any:
        return lines

    lines.append(VoucherLine("-" * line_width))
    if _section_enabled(settings, "payment_header"):
        header = str(texts.get("payment_header") or "COBRO REALIZADO").strip()
        if header:
            lines.append(VoucherLine(_clip_line(header, line_width), centered=True))

    method_code = summary.get("payment_method") or sale.get("payment_method") or sale.get("payment_type")
    if _section_enabled(settings, "payment_method") and method_code:
        method_label = format_payment_method_label(method_code)
        lines.append(_label_value_line("Forma de pago: ", method_label, width=line_width))

    amount_collected = summary.get("amount_collected")
    if amount_collected is None:
        amount_collected = sale.get("amount_paid")
    if _section_enabled(settings, "amount_collected") and amount_collected is not None:
        lines.append(
            _amount_row(
                "Cobrado:",
                float(amount_collected or 0),
                currency,
                width=line_width,
                bold_label=True,
            )
        )

    received = summary.get("received_amount")
    if _section_enabled(settings, "received_amount") and received is not None and float(received) > 0:
        lines.append(
            _amount_row(
                "Recibido:",
                float(received),
                currency,
                width=line_width,
                bold_label=True,
            )
        )

    change = float(summary.get("change_amount") or 0)
    if _section_enabled(settings, "change_amount") and change > 0.009:
        lines.append(
            _amount_row(
                "Cambio:",
                change,
                currency,
                width=line_width,
                bold=True,
                bold_label=True,
            )
        )

    cashier = str(summary.get("cashier_name") or "").strip()
    if _section_enabled(settings, "cashier_name") and cashier:
        lines.append(_label_value_line("Cajero: ", _clip_line(cashier, line_width - 8), width=line_width))

    collected_raw = summary.get("collected_at") or sale.get("collected_at")
    if _section_enabled(settings, "collected_date"):
        collected_label = format_voucher_datetime(collected_raw)
        if collected_label:
            lines.append(_label_value_line("Cobrado: ", collected_label, width=line_width))

    return lines


def build_thermal_invoice_lines(
    sale: Dict[str, Any],
    *,
    vehicle: Optional[Dict[str, Any]] = None,
    width: Optional[int] = None,
    voucher_settings: Optional[Dict[str, Any]] = None,
) -> List[VoucherLine]:
    settings = _resolve_settings(voucher_settings)
    texts = _thermal_texts(settings)
    line_width = int(width or settings.get("chars_per_line") or VOUCHER_WIDTH)
    currency = normalize_currency_code(sale.get("currency"))
    rate = float(sale.get("exchange_rate") or 36.5)

    lines: List[VoucherLine] = []
    invoice_number = normalize_invoice_scan_code(str(sale.get("invoice_number") or ""))

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
    if show_items or show_breakdown:
        lines.append(VoucherLine("-" * line_width))

    if show_items:
        for item in sale.get("items") or []:
            name = str(item.get("product_name") or "Producto")
            if item.get("with_installation") or str(item.get("installation_type") or "") == "required":
                install_usd = float(item.get("installation_price") or 0)
                if install_usd > 0.009:
                    name = f"{name} (+ Instalacion C${install_usd * rate:.0f})"
                else:
                    name = f"{name} (+ Instalacion)"
            for wrapped in _wrap_words(name, line_width):
                lines.append(VoucherLine(wrapped))

            qty = int(item.get("quantity") or 0)
            disc_pct = float(item.get("discount") or 0)
            unit = _convert_item_amount(float(item.get("unit_price") or 0), currency, rate)
            line_total = unit * qty * (1 - disc_pct / 100)
            if item.get("with_installation"):
                install_usd = float(item.get("installation_price") or 0)
                line_total += _convert_item_amount(install_usd, currency, rate) * qty
            detail = f"x{qty}  {format_voucher_money(unit, currency)}"
            if disc_pct > 0.005:
                detail += f"  -{disc_pct:g}%"
            detail += f"  {format_voucher_money(line_total, currency)}"
            lines.append(VoucherLine(_clip_line(detail, line_width)))

    if show_breakdown:
        if show_items:
            lines.append(VoucherLine("-" * line_width))
        for label, amount, opts in visible_breakdown_rows:
            lines.append(
                _amount_row(
                    label,
                    amount,
                    breakdown_currency,
                    width=line_width,
                    negative=bool(opts.get("negative")),
                    bold=bool(opts.get("bold")),
                    bold_label=bool(opts.get("bold_label")),
                )
            )

    collection_lines = _build_collection_lines(sale, settings=settings, line_width=line_width)
    if collection_lines:
        lines.extend(collection_lines)

    from backend.domains.sales.delivery import build_delivery_print_lines

    for delivery_line in build_delivery_print_lines(sale):
        lines.append(VoucherLine(_clip_line(delivery_line, line_width), centered=False))

    if _section_enabled(settings, "header_rules"):
        lines.append(VoucherLine("=" * line_width))
    return lines


def build_thermal_invoice_text_lines(
    sale: Dict[str, Any],
    *,
    vehicle: Optional[Dict[str, Any]] = None,
    width: Optional[int] = None,
    voucher_settings: Optional[Dict[str, Any]] = None,
) -> List[str]:
    return [
        line.text
        for line in build_thermal_invoice_lines(
            sale,
            vehicle=vehicle,
            width=width,
            voucher_settings=voucher_settings,
        )
    ]


def _escpos_qr_code(data: str, *, module_size: int = 6) -> bytes:
    encoded = str(data or "").encode("utf-8")
    if not encoded:
        return b""
    size = max(3, min(8, int(module_size or 6)))
    out = bytearray()
    out.extend(b"\x1d(k\x04\x00\x31\x41\x32\x00")
    out.extend(b"\x1d(k\x03\x00\x31\x43" + bytes([size]))
    out.extend(b"\x1d(k\x03\x00\x31\x45\x30")
    store_len = len(encoded) + 3
    out.extend(b"\x1d(k" + bytes([store_len % 256, store_len // 256]) + b"\x31\x50\x30" + encoded)
    out.extend(b"\x1d(k\x03\x00\x31\x51\x30")
    out.extend(b"\n")
    return bytes(out)


def _append_thermal_invoice_traceability(
    chunks: List[bytes],
    sale: Dict[str, Any],
    *,
    settings: Optional[Dict[str, Any]] = None,
) -> None:
    resolved = _resolve_settings(settings)
    texts = _thermal_texts(resolved)
    width = int(resolved.get("chars_per_line") or VOUCHER_WIDTH)
    margin = int(resolved.get("left_margin_chars") or 0)
    module_width = int(resolved.get("barcode_module_width") or 4)

    invoice_number = normalize_invoice_scan_code(str(sale.get("invoice_number") or ""))
    sale_id = str(sale.get("sale_id") or "").strip()
    show_scan = _section_enabled(resolved, "scan_label")
    show_barcode = _section_enabled(resolved, "barcode")
    show_qr = _section_enabled(resolved, "qr_code")
    if not any((show_scan, show_barcode, show_qr)) or not invoice_number:
        return

    chunks.append(_render_escpos_line(VoucherLine("-" * max(8, width - margin)), settings=resolved))
    if show_scan:
        scan_text = _clip_line(texts.get("scan_label") or "ESCANEAR FACTURA", max(8, width - margin)).strip()
        if scan_text:
            chunks.append(_render_escpos_line(VoucherLine(scan_text, centered=True), settings=resolved))
    if show_barcode:
        chunks.append(_escpos_code128(invoice_number, module_width=module_width))
        centered_invoice = _manual_center_text(invoice_number, width=max(8, width - margin))
        chunks.append(_apply_left_margin(centered_invoice, margin).encode("ascii", "replace") + b"\n")
    if show_qr:
        qr_payload = build_invoice_qr_payload(sale_id=sale_id, invoice_number=invoice_number)
        chunks.append(_escpos_align(1))
        chunks.append(_escpos_qr_code(qr_payload))
        chunks.append(_escpos_align(0))


def _append_thermal_invoice_footer(
    chunks: List[bytes],
    *,
    settings: Optional[Dict[str, Any]] = None,
    sale: Optional[Dict[str, Any]] = None,
) -> None:
    resolved = _resolve_settings(settings)
    texts = _thermal_texts(resolved)
    width = int(resolved.get("chars_per_line") or VOUCHER_WIDTH)
    margin = int(resolved.get("left_margin_chars") or 0)

    if sale:
        _append_thermal_invoice_traceability(chunks, sale, settings=resolved)

    show_footer_paid = _section_enabled(resolved, "footer_paid")
    show_footer_disclaimer = _section_enabled(resolved, "footer_disclaimer")
    if not any((show_footer_paid, show_footer_disclaimer)):
        chunks.append(_escpos_feed(3))
        chunks.append(_escpos_cut())
        return

    chunks.append(_render_escpos_line(VoucherLine("-" * max(8, width - margin)), settings=resolved))
    if show_footer_paid:
        footer_paid = _clip_line(texts.get("footer_paid") or "", max(8, width - margin)).strip()
        if footer_paid:
            chunks.append(
                _render_escpos_line(VoucherLine(footer_paid, centered=True), settings=resolved)
            )
    if show_footer_disclaimer:
        disclaimer = _clip_line(texts.get("footer_disclaimer") or "", max(8, width - margin)).strip()
        if disclaimer:
            chunks.append(
                _render_escpos_line(VoucherLine(disclaimer, centered=True), settings=resolved)
            )
    chunks.append(_escpos_feed(3))
    chunks.append(_escpos_cut())


def build_thermal_invoice_escpos(
    sale: Dict[str, Any],
    *,
    vehicle: Optional[Dict[str, Any]] = None,
    text_lines: Optional[Sequence[str]] = None,
    voucher_settings: Optional[Dict[str, Any]] = None,
) -> bytes:
    settings = _resolve_settings(voucher_settings)
    top_feed = int(settings.get("top_feed_lines") or DEFAULT_THERMAL_INVOICE_SETTINGS["top_feed_lines"])
    if text_lines:
        body_lines = [VoucherLine(str(line)) for line in text_lines]
    else:
        body_lines = build_thermal_invoice_lines(sale, vehicle=vehicle, voucher_settings=settings)

    chunks: List[bytes] = [
        _escpos_init(),
        _escpos_body_font(settings),
        _escpos_align(0),
        _escpos_feed_forward(top_feed),
    ]
    for line in body_lines:
        chunks.append(_render_escpos_line(line, settings=settings))

    _append_thermal_invoice_footer(chunks, settings=settings, sale=sale)
    return b"".join(chunks)


def build_thermal_invoice_preview_pdf(
    sale: Dict[str, Any],
    *,
    vehicle: Optional[Dict[str, Any]] = None,
    text_lines: Optional[List[str]] = None,
    voucher_settings: Optional[Dict[str, Any]] = None,
) -> bytes:
    lines = text_lines or build_thermal_invoice_text_lines(
        sale,
        vehicle=vehicle,
        voucher_settings=voucher_settings,
    )
    return build_seller_voucher_preview_pdf(
        sale,
        vehicle=vehicle,
        text_lines=lines,
        voucher_settings=voucher_settings,
    )