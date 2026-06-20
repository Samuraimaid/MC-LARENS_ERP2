from __future__ import annotations

import base64
from io import BytesIO
from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx

from .dependencies import get_reportlab_symbols

COLOR_PRIMARY = "#1E3A5F"
COLOR_ACCENT = "#3B5BDB"
COLOR_MUTED = "#64748B"
COLOR_TEXT = "#0F172A"
COLOR_BORDER = "#CBD5E1"
COLOR_PANEL = "#F8FAFC"
COLOR_HEADER = "#E8EEF7"

TOPCAR_BRANCH_IDS = {"branch_north", "branch_south"}

WATERMARK_LOGO_PRESETS: Dict[str, str] = {
    "mundo-logo": "mundo-logo.png",
    "topcar-logo": "topcar-logo.png",
    "logo-transparent": "logo-transparent.png",
}

PAYMENT_METHOD_LABELS: Dict[str, str] = {
    "cash": "Efectivo",
    "transfer": "Transferencia",
    "card": "Tarjeta",
    "credit": "Crédito",
    "mixed": "Pago mixto",
    "check": "Cheque",
}

DEFAULT_PDF_DOCUMENT_SETTINGS: Dict[str, Any] = {
    "watermark_enabled": True,
    "watermark_opacity": 0.11,
    "watermark_scale": 0.62,
    "watermark_logo_url": "",
    "show_status_badge": True,
    "theme_colors": {
        "invoice_paid": "#16A34A",
        "quotation": "#2563EB",
        "invoice_credit": "#DC2626",
        "payment_partial": "#EAB308",
        "invoice_pending": "#1E3A5F",
    },
}


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _normalize_hex_color(value: Any, fallback: str) -> str:
    raw = str(value or "").strip()
    if len(raw) == 7 and raw.startswith("#"):
        try:
            int(raw[1:], 16)
            return raw.upper()
        except ValueError:
            return fallback
    return fallback


def normalize_pdf_document_settings(raw: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    data = raw if isinstance(raw, dict) else {}
    defaults = DEFAULT_PDF_DOCUMENT_SETTINGS
    default_colors = defaults["theme_colors"]
    incoming_colors = data.get("theme_colors") if isinstance(data.get("theme_colors"), dict) else {}
    return {
        "watermark_enabled": bool(data.get("watermark_enabled", defaults["watermark_enabled"])),
        "watermark_opacity": round(
            _clamp(float(data.get("watermark_opacity", defaults["watermark_opacity"]) or 0.08), 0.02, 0.35),
            3,
        ),
        "watermark_scale": round(
            _clamp(float(data.get("watermark_scale", defaults["watermark_scale"]) or 0.55), 0.25, 0.9),
            3,
        ),
        "watermark_logo_url": str(data.get("watermark_logo_url") or "").strip(),
        "show_status_badge": bool(data.get("show_status_badge", defaults["show_status_badge"])),
        "theme_colors": {
            "invoice_paid": _normalize_hex_color(incoming_colors.get("invoice_paid"), default_colors["invoice_paid"]),
            "quotation": _normalize_hex_color(incoming_colors.get("quotation"), default_colors["quotation"]),
            "invoice_credit": _normalize_hex_color(incoming_colors.get("invoice_credit"), default_colors["invoice_credit"]),
            "payment_partial": _normalize_hex_color(
                incoming_colors.get("payment_partial"), default_colors["payment_partial"]
            ),
            "invoice_pending": _normalize_hex_color(
                incoming_colors.get("invoice_pending"), default_colors["invoice_pending"]
            ),
        },
    }


def _blend_with_white(hex_color: str, white_ratio: float) -> str:
    try:
        raw = hex_color.lstrip("#")
        red = int(raw[0:2], 16)
        green = int(raw[2:4], 16)
        blue = int(raw[4:6], 16)
        ratio = _clamp(float(white_ratio), 0.0, 1.0)
        red = int(red + (255 - red) * ratio)
        green = int(green + (255 - green) * ratio)
        blue = int(blue + (255 - blue) * ratio)
        return f"#{red:02X}{green:02X}{blue:02X}"
    except Exception:
        return COLOR_HEADER


def build_document_theme(primary_hex: str, badge_label: str = "") -> Dict[str, str]:
    return {
        "primary": primary_hex,
        "accent": primary_hex,
        "header_bg": _blend_with_white(primary_hex, 0.86),
        "panel_bg": _blend_with_white(primary_hex, 0.93),
        "muted": COLOR_MUTED,
        "text": COLOR_TEXT,
        "border": COLOR_BORDER,
        "badge_label": badge_label,
    }


def resolve_invoice_theme(sale: Optional[Dict[str, Any]], pdf_settings: Dict[str, Any]) -> Dict[str, str]:
    colors_cfg = (pdf_settings or {}).get("theme_colors") or DEFAULT_PDF_DOCUMENT_SETTINGS["theme_colors"]
    payment_status = str((sale or {}).get("payment_status") or "").lower()
    payment_type = str((sale or {}).get("payment_type") or "").lower()

    if payment_status == "partial":
        return build_document_theme(colors_cfg.get("payment_partial", "#EAB308"), "Abono registrado")
    if payment_status == "paid":
        return build_document_theme(colors_cfg.get("invoice_paid", "#16A34A"), "Factura pagada")
    if payment_type == "credit":
        return build_document_theme(colors_cfg.get("invoice_credit", "#DC2626"), "Factura a crédito")
    return build_document_theme(colors_cfg.get("invoice_pending", "#1E3A5F"), "Factura pendiente")


def resolve_quotation_theme(pdf_settings: Dict[str, Any]) -> Dict[str, str]:
    colors_cfg = (pdf_settings or {}).get("theme_colors") or DEFAULT_PDF_DOCUMENT_SETTINGS["theme_colors"]
    return build_document_theme(colors_cfg.get("quotation", "#2563EB"), "Cotización")


def _currency_symbol(currencies: Dict[str, Any], code: str) -> str:
    try:
        return currencies.get(code, {}).get("symbol", "C$")
    except Exception:
        return "C$"


def _format_money(currencies: Dict[str, Any], amount: float, currency: str) -> str:
    symbol = _currency_symbol(currencies, currency)
    try:
        return f"{symbol}{float(amount):,.2f}"
    except Exception:
        return f"{symbol}{amount}"


def _safe_date(value: Optional[str]) -> str:
    if not value:
        return ""
    return str(value).replace("T", " ").split("+")[0]


def _format_date_es(value: Optional[str]) -> str:
    raw = _safe_date(value)
    if len(raw) >= 10 and raw[4] == "-":
        year, month, day = raw[:10].split("-")
        return f"{day}/{month}/{year}"
    return raw[:16]


def _truncate(text: str, max_len: int = 42) -> str:
    value = str(text or "").strip()
    if len(value) <= max_len:
        return value
    return value[: max_len - 1] + "…"


def _item_fulfillment_label(item: Dict[str, Any]) -> str:
    install_type = str(item.get("installation_type") or "optional")
    wants_install = bool(item.get("with_installation"))
    if install_type == "not_available":
        return "Para llevar"
    if install_type == "required" or wants_install:
        return "Instalación"
    return "Para llevar"


def _line_gross_amount(item: Dict[str, Any]) -> float:
    qty = float(item.get("quantity") or 0)
    unit = float(item.get("unit_price") or 0)
    return round(unit * qty, 2)


def _line_discount_amount(item: Dict[str, Any]) -> float:
    gross = _line_gross_amount(item)
    discount_pct = float(item.get("discount") or 0)
    return round(gross * discount_pct / 100.0, 2)


def _line_net_amount(item: Dict[str, Any]) -> float:
    stored = item.get("subtotal")
    if stored is not None:
        return round(float(stored or 0), 2)
    return round(_line_gross_amount(item) - _line_discount_amount(item), 2)


def _branding_assets_dir() -> Path:
    backend_dir = Path(__file__).resolve().parents[2]
    packaged = backend_dir / "assets" / "branding"
    if packaged.exists():
        return packaged
    return backend_dir.parent / "frontend" / "public"


def _resolve_branding_asset_path(filename: str) -> str:
    candidate = _branding_assets_dir() / filename
    return str(candidate) if candidate.exists() else ""


def _resolve_header_logo_path(company: Dict[str, Any]) -> str:
    branch_logo = str(company.get("logo_url") or "").strip()
    if branch_logo and (
        branch_logo.startswith("http://")
        or branch_logo.startswith("https://")
        or branch_logo.startswith("data:image")
        or Path(branch_logo).exists()
    ):
        return branch_logo
    branch_id = str(company.get("branch_id") or "").strip()
    preset = "topcar-logo.png" if branch_id in TOPCAR_BRANCH_IDS else "mundo-logo.png"
    return _resolve_branding_asset_path(preset)


def _resolve_watermark_logo_path(company: Dict[str, Any], pdf_settings: Dict[str, Any]) -> str:
    override = str((pdf_settings or {}).get("watermark_logo_url") or "").strip()
    if override:
        if override in WATERMARK_LOGO_PRESETS:
            return _resolve_branding_asset_path(WATERMARK_LOGO_PRESETS[override])
        if override.startswith("preset:"):
            preset_key = override.split(":", 1)[1].strip()
            preset_file = WATERMARK_LOGO_PRESETS.get(preset_key)
            if preset_file:
                return _resolve_branding_asset_path(preset_file)
        if override.startswith("http://") or override.startswith("https://") or Path(override).exists():
            return override
    branch_id = str(company.get("branch_id") or "").strip()
    preset = "topcar-logo.png" if branch_id in TOPCAR_BRANCH_IDS else "mundo-logo.png"
    resolved = _resolve_branding_asset_path(preset)
    if resolved:
        return resolved
    return _resolve_branding_asset_path("logo-transparent.png")


def load_logo_image(logo_url: Optional[str], logger: Any) -> Optional[Any]:
    _, _, ImageReader, _ = get_reportlab_symbols()
    if not logo_url:
        return None
    try:
        if logo_url.startswith("data:image"):
            _header, data = logo_url.split(",", 1)
            return ImageReader(BytesIO(base64.b64decode(data)))
        if logo_url.startswith("http://") or logo_url.startswith("https://"):
            resp = httpx.get(logo_url, timeout=5.0)
            resp.raise_for_status()
            return ImageReader(BytesIO(resp.content))
        path = Path(logo_url)
        if path.exists():
            try:
                from PIL import Image

                image = Image.open(path).convert("RGBA")
                max_side = 420 if "logo" in path.name.lower() else 900
                if max(image.size) > max_side:
                    image.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
                buffer = BytesIO()
                image.save(buffer, format="PNG")
                buffer.seek(0)
                return ImageReader(buffer)
            except Exception:
                return ImageReader(str(path))
    except Exception:
        if logger:
            logger.exception("Failed to load logo image")
    return None


def load_watermark_image(logo_path: Optional[str], opacity: float, logger: Any) -> Optional[Any]:
    _, _, ImageReader, _ = get_reportlab_symbols()
    if not logo_path:
        return None
    try:
        from PIL import Image

        path = Path(logo_path)
        if not path.exists():
            return load_logo_image(logo_path, logger)
        image = Image.open(path).convert("RGBA")
        max_side = 900
        if max(image.size) > max_side:
            image.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
        alpha = image.split()[3]
        factor = _clamp(float(opacity or 0.11), 0.02, 0.35)
        alpha = alpha.point(lambda value: int(value * factor))
        image.putalpha(alpha)
        buffer = BytesIO()
        image.save(buffer, format="PNG")
        buffer.seek(0)
        return ImageReader(buffer)
    except Exception:
        if logger:
            logger.exception("Failed to load watermark image")
        return load_logo_image(logo_path, logger)


def _payment_method_summary(payment_method: Optional[str], mixed_methods: Optional[List[Any]] = None) -> str:
    method = str(payment_method or "cash").strip().lower()
    if method != "mixed":
        return PAYMENT_METHOD_LABELS.get(method, method.title() if method else "—")
    normalized: List[str] = []
    for raw in mixed_methods or []:
        code = str(raw or "").strip().lower()
        if not code or code == "mixed" or code in normalized:
            continue
        normalized.append(code)
    if not normalized:
        return "Pago mixto"
    return " + ".join(PAYMENT_METHOD_LABELS.get(code, code.title()) for code in normalized)


def _build_payment_detail_rows(
    payment_info: Optional[Dict[str, Any]],
    currencies: Dict[str, Any],
    currency: str,
) -> List[tuple[str, Optional[float], str]]:
    info = payment_info or {}
    rows: List[tuple[str, Optional[float], str]] = []
    method_summary = str(info.get("method_summary") or "").strip()
    if method_summary:
        rows.append((f"Forma de pago: {method_summary}", None, "muted"))

    credit_days = info.get("credit_days")
    if credit_days:
        rows.append((f"Plazo de crédito: {int(credit_days)} días", None, "muted"))

    if info.get("discounts_blocked_by_method"):
        blocked = float(info.get("blocked_discounts_amount") or info.get("discounts_removed_amount") or 0)
        if blocked > 0:
            rows.append(("Descuentos removidos por método:", -blocked, "warning"))

    payment_status = str(info.get("payment_status") or "").lower()
    amount_paid = float(info.get("amount_paid") or 0)
    amount_pending = float(info.get("amount_pending") or 0)
    if payment_status == "partial":
        rows.append(("Abonado a la fecha:", amount_paid, "accent"))
        rows.append(("Saldo pendiente:", amount_pending, "accent"))
    elif payment_status == "paid":
        rows.append(("Estado de cobro: Pagado en su totalidad", None, "success"))

    total_legal = float(info.get("total_legal") or 0)
    net_to_collect = float(info.get("net_to_collect") or total_legal)
    if total_legal > 0 and abs(net_to_collect - total_legal) > 0.009:
        rows.append(("Neto a cobrar:", net_to_collect, "text"))

    return rows


def _draw_watermark_background(
    p: Any,
    logo: Any,
    width: float,
    height: float,
    opacity: float,
    scale: float,
) -> None:
    if not logo:
        return
    wm_width = width * _clamp(scale, 0.25, 0.9)
    wm_height = wm_width * 0.75
    x = (width - wm_width) / 2
    y = (height - wm_height) / 2
    p.drawImage(logo, x, y, width=wm_width, height=wm_height, preserveAspectRatio=True, mask="auto")


def _prepare_pdf_page(
    p: Any,
    width: float,
    height: float,
    *,
    company: Dict[str, Any],
    pdf_settings: Dict[str, Any],
    logger: Any,
    logo_cache: Dict[str, Any],
) -> Optional[Any]:
    settings = normalize_pdf_document_settings(pdf_settings)
    if settings.get("watermark_enabled"):
        wm_path = _resolve_watermark_logo_path(company, settings)
        if wm_path and "watermark" not in logo_cache:
            logo_cache["watermark"] = load_watermark_image(
                wm_path,
                float(settings.get("watermark_opacity") or 0.11),
                logger,
            )
        wm_logo = logo_cache.get("watermark")
        if wm_logo:
            _draw_watermark_background(
                p,
                wm_logo,
                width,
                height,
                float(settings.get("watermark_opacity") or 0.11),
                float(settings.get("watermark_scale") or 0.62),
            )
    if "header" not in logo_cache:
        header_path = _resolve_header_logo_path(company)
        logo_cache["header"] = load_logo_image(header_path, logger) if header_path else None
    return logo_cache.get("header")


def _draw_status_badge(
    p: Any,
    colors: Any,
    *,
    x: float,
    y: float,
    theme: Dict[str, str],
    enabled: bool,
    align: str = "left",
) -> None:
    label = str(theme.get("badge_label") or "").strip()
    if not enabled or not label:
        return
    primary = theme.get("primary", COLOR_PRIMARY)
    p.setFont("Helvetica-Bold", 7.5)
    text_width = p.stringWidth(label, "Helvetica-Bold", 7.5)
    pad_x = 8
    box_width = text_width + (pad_x * 2)
    box_height = 16
    if align == "right":
        box_x = x - box_width
        text_x = x - pad_x
        draw_text = lambda: p.drawRightString(text_x, y, label)
    else:
        box_x = x
        text_x = x + pad_x
        draw_text = lambda: p.drawString(text_x, y, label)
    p.setFillColor(colors.HexColor(_blend_with_white(primary, 0.78)))
    p.roundRect(box_x, y - 4, box_width, box_height, 4, stroke=0, fill=1)
    p.setFillColor(colors.HexColor(primary))
    draw_text()


def _draw_rounded_panel(
    p: Any,
    colors: Any,
    x: float,
    y: float,
    width: float,
    height: float,
    fill: str = COLOR_PANEL,
    stroke: str = COLOR_BORDER,
) -> None:
    p.setFillColor(colors.HexColor(fill))
    p.setStrokeColor(colors.HexColor(stroke))
    p.setLineWidth(0.6)
    p.roundRect(x, y, width, height, 6, stroke=1, fill=1)


def _draw_label_value(
    p: Any,
    colors: Any,
    x: float,
    y: float,
    label: str,
    value: str,
    label_width: float = 72,
) -> float:
    p.setFillColor(colors.HexColor(COLOR_MUTED))
    p.setFont("Helvetica", 8)
    p.drawString(x, y, label)
    p.setFillColor(colors.HexColor(COLOR_TEXT))
    p.setFont("Helvetica", 9)
    p.drawString(x + label_width, y, _truncate(value, 52))
    return y - 13


def _draw_company_footer(
    p: Any,
    colors: Any,
    company: Dict[str, Any],
    width: float,
    y: float,
) -> None:
    p.setStrokeColor(colors.HexColor(COLOR_BORDER))
    p.line(50, y + 18, width - 50, y + 18)
    p.setFillColor(colors.HexColor(COLOR_MUTED))
    p.setFont("Helvetica", 8)
    parts = [
        company.get("legal_name") or company.get("name") or "MUNDO DE ACCESORIOS",
        f"RUC: {company.get('tax_id')}" if company.get("tax_id") else "",
        company.get("address") or "",
        " · ".join(
            part
            for part in [
                company.get("city") or "",
                company.get("country") or "",
                f"Tel: {company.get('phone')}" if company.get("phone") else "",
                company.get("email") or "",
            ]
            if part
        ),
    ]
    line_y = y
    for part in parts:
        if not part:
            continue
        p.drawCentredString(width / 2, line_y, _truncate(part, 110))
        line_y -= 11


def _compute_discount_breakdown(
    items: List[Dict[str, Any]],
    sale_totals: Dict[str, Any],
) -> Dict[str, float]:
    line_discount_total = round(sum(_line_discount_amount(item) for item in items), 2)
    gross_before_line = round(sum(_line_gross_amount(item) for item in items), 2)
    subtotal = round(float(sale_totals.get("subtotal") or 0), 2)
    global_discount = round(
        float(
            sale_totals.get("global_discount")
            or sale_totals.get("discount")
            or sale_totals.get("discounts_applied_amount")
            or 0
        ),
        2,
    )
    global_percent = 0.0
    if subtotal > 0 and global_discount > 0:
        global_percent = round(global_discount / subtotal * 100.0, 2)
    return {
        "gross_before_line": gross_before_line,
        "line_discount_total": line_discount_total,
        "subtotal": subtotal,
        "global_discount": global_discount,
        "global_percent": global_percent,
    }


def draw_invoice_letter_pdf(
    p: Any,
    *,
    invoice_number: str,
    invoice_date: str,
    company: Dict[str, Any],
    customer: Dict[str, Any],
    vehicle: Optional[Dict[str, Any]],
    items: Any,
    currency: str,
    iva_rate: float,
    apply_iva: bool,
    totals: Dict[str, Any],
    currencies: Dict[str, Any],
    logger: Any,
    salesperson_name: str = "",
    payment_method: str = "",
    notes: Optional[str] = None,
    pdf_settings: Optional[Dict[str, Any]] = None,
    document_theme: Optional[Dict[str, str]] = None,
    sale_payment_meta: Optional[Dict[str, Any]] = None,
    payment_info: Optional[Dict[str, Any]] = None,
) -> None:
    colors, letter, _, _ = get_reportlab_symbols()
    width, height = letter
    safe_items = [item for item in (items if isinstance(items, list) else list(items or [])) if item]
    breakdown = _compute_discount_breakdown(safe_items, totals)
    settings = normalize_pdf_document_settings(pdf_settings)
    theme = document_theme or build_document_theme(COLOR_PRIMARY, "Factura")
    logo_cache: Dict[str, Any] = {}

    margin_x = 42
    content_width = width - (margin_x * 2)

    def _new_page() -> float:
        _prepare_pdf_page(
            p, width, height, company=company, pdf_settings=settings, logger=logger, logo_cache=logo_cache
        )
        return height - 72

    _prepare_pdf_page(
        p, width, height, company=company, pdf_settings=settings, logger=logger, logo_cache=logo_cache
    )

    header_height = 118
    header_bottom = height - header_height

    # Encabezado
    p.setFillColor(colors.HexColor(theme.get("header_bg", COLOR_HEADER)))
    p.rect(0, header_bottom, width, header_height, stroke=0, fill=1)

    logo = logo_cache.get("header") or load_logo_image(_resolve_header_logo_path(company), logger)
    brand_x = margin_x
    if logo:
        p.drawImage(logo, margin_x, height - 96, width=88, height=42, preserveAspectRatio=True, mask="auto")
        brand_x = margin_x + 98

    p.setFillColor(colors.HexColor(theme.get("primary", COLOR_PRIMARY)))
    p.setFont("Helvetica-Bold", 17)
    p.drawString(brand_x, height - 58, company.get("name", "MUNDO DE ACCESORIOS"))
    p.setFont("Helvetica", 9)
    p.setFillColor(colors.HexColor(theme.get("muted", COLOR_MUTED)))
    tagline = company.get("tagline") or "Accesorios y servicios automotrices"
    if tagline.lower() == "sistema erp":
        tagline = "Accesorios y servicios automotrices"
    p.drawString(brand_x, height - 72, tagline)

    info_y = height - 86
    if salesperson_name:
        p.setFillColor(colors.HexColor(theme.get("text", COLOR_TEXT)))
        p.setFont("Helvetica-Bold", 8.5)
        p.drawString(brand_x, info_y, f"Vendedor: {salesperson_name}")
        info_y -= 14

    _draw_status_badge(
        p,
        colors,
        x=brand_x,
        y=info_y,
        theme=theme,
        enabled=bool(settings.get("show_status_badge")),
        align="left",
    )

    right_block_x = width - margin_x
    p.setFillColor(colors.HexColor(theme.get("primary", COLOR_PRIMARY)))
    p.setFont("Helvetica-Bold", 10)
    p.drawRightString(right_block_x, height - 50, "Factura N°")
    p.setFont("Helvetica-Bold", 13)
    p.drawRightString(right_block_x, height - 68, str(invoice_number or "—"))
    p.setFont("Helvetica-Bold", 9)
    p.drawRightString(right_block_x, height - 86, "Fecha")
    p.setFont("Helvetica", 10)
    p.drawRightString(right_block_x, height - 100, _format_date_es(invoice_date))

    y = height - 142

    # Cliente y vehículo arriba
    panel_height = 104
    half_width = (content_width - 12) / 2
    _draw_rounded_panel(
        p, colors, margin_x, y - panel_height, half_width, panel_height, fill=theme.get("panel_bg", COLOR_PANEL)
    )
    _draw_rounded_panel(
        p,
        colors,
        margin_x + half_width + 12,
        y - panel_height,
        half_width,
        panel_height,
        fill=theme.get("panel_bg", COLOR_PANEL),
    )

    p.setFillColor(colors.HexColor(theme.get("accent", COLOR_ACCENT)))
    p.setFont("Helvetica-Bold", 9)
    p.drawString(margin_x + 12, y - 16, "DATOS DEL CLIENTE")
    p.drawString(margin_x + half_width + 24, y - 16, "DATOS DEL VEHÍCULO")

    client_y = y - 30
    client_y = _draw_label_value(p, colors, margin_x + 12, client_y, "Nombre:", customer.get("name", ""))
    client_y = _draw_label_value(p, colors, margin_x + 12, client_y, "RUC:", customer.get("tax_id", "") or "—")
    client_y = _draw_label_value(p, colors, margin_x + 12, client_y, "Teléfono:", customer.get("phone", "") or "—")
    client_y = _draw_label_value(p, colors, margin_x + 12, client_y, "Correo:", customer.get("email", "") or "—")
    _draw_label_value(p, colors, margin_x + 12, client_y, "Dirección:", customer.get("address", "") or "—")

    vehicle_y = y - 30
    if vehicle:
        vehicle_label = " ".join(
            part
            for part in [
                str(vehicle.get("brand") or "").strip(),
                str(vehicle.get("model") or "").strip(),
                str(vehicle.get("year") or "").strip(),
            ]
            if part
        ).strip() or "—"
        vehicle_y = _draw_label_value(p, colors, margin_x + half_width + 24, vehicle_y, "Vehículo:", vehicle_label)
        vehicle_y = _draw_label_value(
            p, colors, margin_x + half_width + 24, vehicle_y, "Placa:", vehicle.get("plate", "") or "—"
        )
        vin = vehicle.get("vin") or vehicle.get("chasis")
        vehicle_y = _draw_label_value(p, colors, margin_x + half_width + 24, vehicle_y, "Chasis:", vin or "—")
        _draw_label_value(p, colors, margin_x + half_width + 24, vehicle_y, "Color:", vehicle.get("color", "") or "—")
    else:
        _draw_label_value(p, colors, margin_x + half_width + 24, vehicle_y, "Vehículo:", "Sin vehículo asociado")

    y = y - panel_height - 20

    # Encabezado de tabla
    p.setFillColor(colors.HexColor(theme.get("primary", COLOR_PRIMARY)))
    p.rect(margin_x, y - 4, content_width, 20, stroke=0, fill=1)
    p.setFillColor(colors.white)
    p.setFont("Helvetica-Bold", 8)
    p.drawString(margin_x + 6, y + 2, "#")
    p.drawString(margin_x + 24, y + 2, "Producto")
    p.drawString(margin_x + 210, y + 2, "Modalidad")
    p.drawRightString(margin_x + 300, y + 2, "P. unit.")
    p.drawRightString(margin_x + 348, y + 2, "Cant.")
    p.drawRightString(margin_x + 392, y + 2, "Desc.")
    p.drawRightString(width - margin_x - 6, y + 2, "Importe")
    y -= 22

    p.setFont("Helvetica", 8.5)
    index = 1
    installed_items = [item for item in safe_items if _item_fulfillment_label(item) == "Instalación"]
    carry_items = [item for item in safe_items if _item_fulfillment_label(item) == "Para llevar"]

    def _draw_items_group(title: str, group_items: List[Dict[str, Any]]) -> None:
        nonlocal y, index
        if not group_items:
            return
        if y < 170:
            p.showPage()
            y = _new_page()
        p.setFillColor(colors.HexColor(_blend_with_white(theme.get("primary", COLOR_PRIMARY), 0.82)))
        p.rect(margin_x, y - 2, content_width, 14, stroke=0, fill=1)
        p.setFillColor(colors.HexColor(theme.get("primary", COLOR_PRIMARY)))
        p.setFont("Helvetica-Bold", 8)
        p.drawString(margin_x + 6, y + 1, title)
        y -= 16

        for item in group_items:
            if y < 150:
                p.showPage()
                y = _new_page()
            if index % 2 == 0:
                p.setFillColor(colors.HexColor("#F8FAFC"))
                p.rect(margin_x, y - 4, content_width, 16, stroke=0, fill=1)
            p.setFillColor(colors.HexColor(COLOR_TEXT))
            p.setFont("Helvetica", 8.5)
            discount_pct = float(item.get("discount") or 0)
            p.drawString(margin_x + 6, y, str(index))
            p.drawString(margin_x + 24, y, _truncate(item.get("product_name", ""), 30))
            p.drawString(margin_x + 210, y, _item_fulfillment_label(item))
            p.drawRightString(margin_x + 300, y, _format_money(currencies, item.get("unit_price", 0), currency))
            p.drawRightString(margin_x + 348, y, f"{int(float(item.get('quantity') or 0))}")
            p.drawRightString(margin_x + 392, y, f"{discount_pct:.0f}%" if discount_pct else "—")
            p.drawRightString(width - margin_x - 6, y, _format_money(currencies, _line_net_amount(item), currency))
            y -= 16
            index += 1

    _draw_items_group("PRODUCTOS INSTALADOS", installed_items)
    _draw_items_group("PRODUCTOS PARA LLEVAR", carry_items)
    if not installed_items and not carry_items:
        p.drawString(margin_x + 6, y, "Sin productos registrados")
        y -= 16

    y -= 8

    # Totales
    totals_box_width = 230
    totals_x = width - margin_x - totals_box_width
    totals_lines = [
        ("Subtotal bruto:", breakdown["gross_before_line"]),
    ]
    if breakdown["line_discount_total"] > 0:
        totals_lines.append(("Descuento por línea:", -breakdown["line_discount_total"]))
    totals_lines.append(("Subtotal:", breakdown["subtotal"]))
    if breakdown["global_discount"] > 0:
        label = "Descuento global"
        if breakdown["global_percent"] > 0:
            label += f" ({breakdown['global_percent']:.1f}%)"
        totals_lines.append((f"{label}:", -breakdown["global_discount"]))

    iva_amount = float(totals.get("tax") or totals.get("iva_amount") or 0)
    if apply_iva and iva_amount > 0:
        iva_label = f"IVA ({float(iva_rate or 0):.0f}%):" if iva_rate else "IVA:"
        totals_lines.append((iva_label, iva_amount))

    retention_amount = float(totals.get("retention_amount") or 0)
    if retention_amount > 0:
        retention_rate = float(totals.get("retention_rate") or 0)
        if retention_rate <= 1:
            retention_rate *= 100
        label = f"Retención IR ({retention_rate:.0f}%):" if retention_rate else "Retención IR:"
        totals_lines.append((label, -retention_amount))

    merged_payment_info = {
        **(sale_payment_meta or {}),
        **(payment_info or {}),
    }
    if not merged_payment_info.get("method_summary") and payment_method:
        merged_payment_info["method_summary"] = payment_method
    payment_detail_rows = _build_payment_detail_rows(merged_payment_info, currencies, currency)

    box_height = 24 + len(totals_lines) * 14 + len(payment_detail_rows) * 14 + 34
    if y - box_height < 90:
        p.showPage()
        y = _new_page() - 18
    box_top = y
    _draw_rounded_panel(p, colors, totals_x, box_top - box_height, totals_box_width, box_height, fill="#FFFFFF")

    line_y = box_top - 18
    p.setFont("Helvetica", 9)
    for label, amount in totals_lines:
        p.setFillColor(colors.HexColor(COLOR_MUTED))
        p.drawString(totals_x + 12, line_y, label)
        amount_text = _format_money(currencies, abs(float(amount)), currency)
        if float(amount) < 0:
            amount_text = f"-{amount_text}"
            p.setFillColor(colors.HexColor("#B45309"))
        else:
            p.setFillColor(colors.HexColor(COLOR_TEXT))
        p.drawRightString(width - margin_x - 12, line_y, amount_text)
        line_y -= 14

    if payment_detail_rows:
        line_y -= 4
        p.setStrokeColor(colors.HexColor(COLOR_BORDER))
        p.line(totals_x + 10, line_y, width - margin_x - 10, line_y)
        line_y -= 12

    color_map = {
        "muted": COLOR_MUTED,
        "text": COLOR_TEXT,
        "warning": "#B45309",
        "accent": theme.get("primary", COLOR_PRIMARY),
        "success": "#15803D",
    }
    for label, amount, tone in payment_detail_rows:
        p.setFont("Helvetica", 8.5 if tone == "muted" else 9)
        p.setFillColor(colors.HexColor(color_map.get(tone, COLOR_TEXT)))
        if amount is None:
            p.drawString(totals_x + 12, line_y, _truncate(label, 42))
        else:
            p.drawString(totals_x + 12, line_y, _truncate(label, 28))
            amount_text = _format_money(currencies, abs(float(amount)), currency)
            if float(amount) < 0:
                amount_text = f"-{amount_text}"
            p.drawRightString(width - margin_x - 12, line_y, amount_text)
        line_y -= 14

    total_value = float(totals.get("total_legal") or totals.get("total") or 0)
    p.setFillColor(colors.HexColor(theme.get("accent", COLOR_ACCENT)))
    p.rect(totals_x + 8, line_y - 10, totals_box_width - 16, 22, stroke=0, fill=1)
    p.setFillColor(colors.white)
    p.setFont("Helvetica-Bold", 10)
    p.drawString(totals_x + 16, line_y - 2, "TOTAL")
    p.drawRightString(width - margin_x - 12, line_y - 2, _format_money(currencies, total_value, currency))

    if notes:
        notes_y = box_top - box_height - 20
        if notes_y < 80:
            p.showPage()
            _new_page()
            notes_y = height - 100
        p.setFillColor(colors.HexColor(COLOR_TEXT))
        p.setFont("Helvetica-Bold", 9)
        p.drawString(margin_x, notes_y, "Notas")
        p.setFont("Helvetica", 9)
        p.drawString(margin_x, notes_y - 14, _truncate(notes, 120))

    _draw_company_footer(p, colors, company, width, 42)


def draw_document_pdf(
    p: Any,
    doc_title: str,
    doc_number: str,
    doc_date: str,
    company: Dict[str, Any],
    customer: Dict[str, Any],
    vehicle: Optional[Dict[str, Any]],
    items: Any,
    currency: str,
    iva_rate: float,
    apply_iva: bool,
    totals: Dict[str, Any],
    currencies: Dict[str, Any],
    logger: Any,
    notes: Optional[str] = None,
    pdf_settings: Optional[Dict[str, Any]] = None,
    document_theme: Optional[Dict[str, str]] = None,
) -> None:
    """Cotizaciones y documentos genéricos en carta (español)."""
    title_map = {
        "Quotation": "Cotización",
        "Invoice": "Factura",
        "Factura": "Factura",
        "Cotización": "Cotización",
    }
    spanish_title = title_map.get(doc_title, doc_title)

    colors, letter, _, _ = get_reportlab_symbols()
    width, height = letter
    safe_items = [item for item in (items if isinstance(items, list) else list(items or [])) if item]
    breakdown = _compute_discount_breakdown(safe_items, totals)
    settings = normalize_pdf_document_settings(pdf_settings)
    theme = document_theme or resolve_quotation_theme(settings)
    logo_cache: Dict[str, Any] = {}

    margin_x = 42
    content_width = width - (margin_x * 2)

    _prepare_pdf_page(
        p, width, height, company=company, pdf_settings=settings, logger=logger, logo_cache=logo_cache
    )

    p.setFillColor(colors.HexColor(theme.get("header_bg", COLOR_HEADER)))
    p.rect(0, height - 100, width, 100, stroke=0, fill=1)

    logo = logo_cache.get("header") or load_logo_image(_resolve_header_logo_path(company), logger)
    brand_x = margin_x
    if logo:
        p.drawImage(logo, margin_x, height - 86, width=84, height=38, preserveAspectRatio=True, mask="auto")
        brand_x = margin_x + 94

    p.setFillColor(colors.HexColor(theme.get("primary", COLOR_PRIMARY)))
    p.setFont("Helvetica-Bold", 16)
    p.drawString(brand_x, height - 54, company.get("name", "MUNDO DE ACCESORIOS"))

    right_x = width - margin_x
    p.setFont("Helvetica-Bold", 10)
    p.drawRightString(right_x, height - 46, f"{spanish_title} N°")
    p.setFont("Helvetica-Bold", 12)
    p.drawRightString(right_x, height - 64, str(doc_number or "—"))
    p.setFont("Helvetica-Bold", 9)
    p.drawRightString(right_x, height - 82, "Fecha")
    p.setFont("Helvetica", 10)
    p.drawRightString(right_x, height - 96, _format_date_es(doc_date))
    _draw_status_badge(
        p,
        colors,
        x=margin_x + 12,
        y=height - 72,
        theme=theme,
        enabled=bool(settings.get("show_status_badge")),
        align="left",
    )

    y = height - 118
    panel_height = 84
    half_width = (content_width - 12) / 2
    _draw_rounded_panel(
        p, colors, margin_x, y - panel_height, half_width, panel_height, fill=theme.get("panel_bg", COLOR_PANEL)
    )
    _draw_rounded_panel(
        p,
        colors,
        margin_x + half_width + 12,
        y - panel_height,
        half_width,
        panel_height,
        fill=theme.get("panel_bg", COLOR_PANEL),
    )

    p.setFillColor(colors.HexColor(theme.get("accent", COLOR_ACCENT)))
    p.setFont("Helvetica-Bold", 9)
    p.drawString(margin_x + 12, y - 16, "CLIENTE")
    p.drawString(margin_x + half_width + 24, y - 16, "VEHÍCULO")

    client_y = y - 30
    client_y = _draw_label_value(p, colors, margin_x + 12, client_y, "Nombre:", customer.get("name", ""))
    _draw_label_value(p, colors, margin_x + 12, client_y, "Teléfono:", customer.get("phone", "") or "—")

    vehicle_y = y - 30
    if vehicle:
        vehicle_label = " ".join(
            part
            for part in [
                str(vehicle.get("brand") or "").strip(),
                str(vehicle.get("model") or "").strip(),
                str(vehicle.get("year") or "").strip(),
            ]
            if part
        ).strip() or "—"
        vehicle_y = _draw_label_value(p, colors, margin_x + half_width + 24, vehicle_y, "Vehículo:", vehicle_label)
        _draw_label_value(p, colors, margin_x + half_width + 24, vehicle_y, "Placa:", vehicle.get("plate", "") or "—")
    else:
        _draw_label_value(p, colors, margin_x + half_width + 24, vehicle_y, "Vehículo:", "Sin vehículo")

    y -= panel_height + 20
    p.setFillColor(colors.HexColor(theme.get("primary", COLOR_PRIMARY)))
    p.rect(margin_x, y - 4, content_width, 18, stroke=0, fill=1)
    p.setFillColor(colors.white)
    p.setFont("Helvetica-Bold", 8)
    p.drawString(margin_x + 6, y + 2, "#")
    p.drawString(margin_x + 24, y + 2, "Producto")
    p.drawString(margin_x + 250, y + 2, "Modalidad")
    p.drawRightString(margin_x + 360, y + 2, "Cant.")
    p.drawRightString(width - margin_x - 6, y + 2, "Importe")
    y -= 20

    p.setFont("Helvetica", 8.5)
    for index, item in enumerate(safe_items, start=1):
        if y < 130:
            p.showPage()
            _prepare_pdf_page(
                p, width, height, company=company, pdf_settings=settings, logger=logger, logo_cache=logo_cache
            )
            y = height - 72
        p.setFillColor(colors.HexColor(COLOR_TEXT))
        p.drawString(margin_x + 6, y, str(index))
        p.drawString(margin_x + 24, y, _truncate(item.get("product_name", ""), 34))
        p.drawString(margin_x + 250, y, _item_fulfillment_label(item))
        p.drawRightString(margin_x + 360, y, f"{int(float(item.get('quantity') or 0))}")
        p.drawRightString(width - margin_x - 6, y, _format_money(currencies, _line_net_amount(item), currency))
        y -= 15

    totals_x = width - margin_x - 220
    box_height = 110
    if y - box_height < 80:
        p.showPage()
        y = height - 90
    _draw_rounded_panel(p, colors, totals_x, y - box_height, 220, box_height)
    line_y = y - 18
    p.setFont("Helvetica", 9)
    rows = [
        ("Subtotal:", breakdown["subtotal"]),
    ]
    if breakdown["global_discount"] > 0:
        rows.append(("Descuento:", -breakdown["global_discount"]))
    if apply_iva:
        rows.append((f"IVA ({float(iva_rate or 0):.0f}%):", float(totals.get("tax") or 0)))
    for label, amount in rows:
        p.setFillColor(colors.HexColor(COLOR_MUTED))
        p.drawString(totals_x + 12, line_y, label)
        p.setFillColor(colors.HexColor(COLOR_TEXT))
        display_amount = abs(amount) if amount < 0 else amount
        prefix = "-" if amount < 0 else ""
        p.drawRightString(width - margin_x - 12, line_y, f"{prefix}{_format_money(currencies, display_amount, currency)}")
        line_y -= 14

    p.setFillColor(colors.HexColor(theme.get("accent", COLOR_ACCENT)))
    p.rect(totals_x + 8, line_y - 10, 204, 20, stroke=0, fill=1)
    p.setFillColor(colors.white)
    p.setFont("Helvetica-Bold", 10)
    p.drawString(totals_x + 16, line_y - 2, "TOTAL")
    p.drawRightString(width - margin_x - 12, line_y - 2, _format_money(currencies, totals.get("total", 0), currency))

    if notes:
        p.setFillColor(colors.HexColor(COLOR_TEXT))
        p.setFont("Helvetica-Bold", 9)
        p.drawString(margin_x, y - box_height - 16, "Notas")
        p.setFont("Helvetica", 9)
        p.drawString(margin_x, y - box_height - 30, _truncate(notes, 120))

    _draw_company_footer(p, colors, company, width, 42)


def draw_payment_receipt_pdf(
    p: Any,
    *,
    sale: Dict[str, Any],
    company: Dict[str, Any],
    customer: Dict[str, Any],
    payment: Optional[Dict[str, Any]],
    currencies: Dict[str, Any],
    logger: Any,
    pdf_settings: Optional[Dict[str, Any]] = None,
    document_theme: Optional[Dict[str, str]] = None,
) -> None:
    colors, letter, _, _ = get_reportlab_symbols()
    width, height = letter
    settings = normalize_pdf_document_settings(pdf_settings)
    theme = document_theme or build_document_theme(
        (settings.get("theme_colors") or {}).get("payment_partial", "#EAB308"),
        "Comprobante de abono",
    )
    logo_cache: Dict[str, Any] = {}
    _prepare_pdf_page(
        p, width, height, company=company, pdf_settings=settings, logger=logger, logo_cache=logo_cache
    )

    margin_x = 42
    currency = str(sale.get("currency") or "NIO")
    payment_row = payment or {}
    amount = float(payment_row.get("amount") or sale.get("amount_paid") or 0)
    paid_total = float(sale.get("amount_paid") or 0)
    pending_total = float(sale.get("amount_pending") or 0)
    invoice_total = float(sale.get("total_legal") or sale.get("total") or 0)

    p.setFillColor(colors.HexColor(theme.get("header_bg", COLOR_HEADER)))
    p.rect(0, height - 96, width, 96, stroke=0, fill=1)
    p.setFillColor(colors.HexColor(theme.get("primary", COLOR_PRIMARY)))
    p.setFont("Helvetica-Bold", 18)
    p.drawString(margin_x, height - 52, "Comprobante de abono")
    p.setFont("Helvetica", 10)
    p.drawString(margin_x, height - 68, company.get("name", "MUNDO DE ACCESORIOS"))
    _draw_status_badge(
        p,
        colors,
        x=width - margin_x,
        y=height - 58,
        theme=theme,
        enabled=True,
        align="right",
    )

    y = height - 120
    panel_height = 132
    _draw_rounded_panel(
        p, colors, margin_x, y - panel_height, width - (margin_x * 2), panel_height, fill=theme.get("panel_bg", COLOR_PANEL)
    )
    lines = [
        ("Factura:", str(sale.get("invoice_number") or "—")),
        ("Cliente:", customer.get("name", "")),
        ("Fecha de abono:", _format_date_es(payment_row.get("created_at") or sale.get("updated_at"))),
        ("Forma de pago:", _payment_method_summary(payment_row.get("payment_method") or sale.get("payment_method"), sale.get("mixed_payment_methods"))),
        ("Monto de este abono:", _format_money(currencies, amount, currency)),
        ("Total abonado:", _format_money(currencies, paid_total, currency)),
        ("Saldo pendiente:", _format_money(currencies, pending_total, currency)),
        ("Total factura:", _format_money(currencies, invoice_total, currency)),
    ]
    line_y = y - 20
    for label, value in lines:
        line_y = _draw_label_value(p, colors, margin_x + 14, line_y, label, value, label_width=118)

    p.setFillColor(colors.HexColor(COLOR_MUTED))
    p.setFont("Helvetica", 8.5)
    p.drawCentredString(width / 2, 58, "Documento generado automáticamente por ERP.")
    _draw_company_footer(p, colors, company, width, 42)


def build_preview_pdf_bytes(
    *,
    preview_kind: str,
    company: Dict[str, Any],
    currencies: Dict[str, Any],
    logger: Any,
    pdf_settings: Optional[Dict[str, Any]] = None,
) -> bytes:
    settings = normalize_pdf_document_settings(pdf_settings)
    sample_items = [
        {
            "product_name": "Piso de goma universal",
            "quantity": 1,
            "unit_price": 1200,
            "discount": 0,
            "subtotal": 1200,
            "with_installation": True,
            "installation_type": "optional",
        },
        {
            "product_name": "Aroma premium",
            "quantity": 2,
            "unit_price": 150,
            "discount": 0,
            "subtotal": 300,
            "with_installation": False,
            "installation_type": "not_available",
        },
    ]
    sample_customer = {"name": "Cliente de ejemplo", "tax_id": "J-00000000-0", "phone": "8888-8888", "email": "cliente@ejemplo.com", "address": "Managua"}
    sample_vehicle = {"brand": "TOYOTA", "model": "COROLLA", "year": "2024", "plate": "M123456", "color": "Blanco"}
    sample_totals = {
        "subtotal": 1500,
        "tax": 225,
        "total": 1725,
        "total_legal": 1725,
        "discount": 0,
        "retention_amount": 0,
        "retention_rate": 0,
    }

    _, letter, _, canvas = get_reportlab_symbols()
    buffer = BytesIO()
    p = canvas.Canvas(buffer, pagesize=letter)

    kind = str(preview_kind or "invoice_paid").strip().lower()
    if kind == "quotation":
        theme = resolve_quotation_theme(settings)
        draw_document_pdf(
            p,
            "Cotización",
            "COT-PREVIEW-001",
            "2026-06-20T12:00:00",
            company,
            sample_customer,
            sample_vehicle,
            sample_items,
            "NIO",
            15,
            True,
            sample_totals,
            currencies,
            logger,
            notes="Vista previa de cotización.",
            pdf_settings=settings,
            document_theme=theme,
        )
    else:
        sale_samples = {
            "invoice_paid": {"payment_status": "paid", "payment_type": "cash", "payment_method": "cash"},
            "invoice_credit": {"payment_status": "pending", "payment_type": "credit", "payment_method": "credit", "credit_days": 30},
            "payment_partial": {
                "payment_status": "partial",
                "payment_type": "cash",
                "payment_method": "cash",
                "amount_paid": 800,
                "amount_pending": 925,
            },
            "invoice_pending": {"payment_status": "pending", "payment_type": "cash", "payment_method": "cash"},
        }
        sample_sale = sale_samples.get(kind, sale_samples["invoice_paid"])
        theme = resolve_invoice_theme(sample_sale, settings)
        draw_invoice_letter_pdf(
            p,
            invoice_number="INV-PREVIEW-001",
            invoice_date="2026-06-20T12:00:00",
            company=company,
            customer=sample_customer,
            vehicle=sample_vehicle,
            items=sample_items,
            currency="NIO",
            iva_rate=15,
            apply_iva=True,
            totals=sample_totals,
            currencies=currencies,
            logger=logger,
            salesperson_name="Vendedor Demo",
            payment_method=_payment_method_summary(sample_sale.get("payment_method"), []),
            notes="Vista previa de documento PDF.",
            pdf_settings=settings,
            document_theme=theme,
            sale_payment_meta=sample_sale,
            payment_info={
                **sample_sale,
                "method_summary": _payment_method_summary(sample_sale.get("payment_method"), []),
                "total_legal": sample_totals["total_legal"],
                "net_to_collect": sample_totals["total_legal"],
            },
        )

    p.save()
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes


def build_retention_receipt_pdf_bytes(receipt: Dict[str, Any], sale: Dict[str, Any]) -> bytes:
    _, letter, _, canvas = get_reportlab_symbols()
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    c.setFont("Helvetica-Bold", 13)
    c.drawString(50, 760, "Comprobante de Retención IR")
    c.setFont("Helvetica", 10)
    lines = [
        f"Correlativo: {receipt.get('receipt_number', 'N/A')}",
        f"Fecha: {receipt.get('created_at', '')}",
        f"Factura: {sale.get('invoice_number', 'N/A')}",
        f"Venta ID: {sale.get('sale_id', 'N/A')}",
        f"Cliente: {sale.get('customer_name', 'N/A')}",
        f"Sucursal: {sale.get('branch_id', 'N/A')}",
        f"Subtotal base: C${float(receipt.get('subtotal_base') or 0.0):,.2f}",
        f"Tasa retención: {float(receipt.get('retention_rate') or 0.0) * 100:.2f}%",
        f"Monto retenido: C${float(receipt.get('retention_amount') or 0.0):,.2f}",
        f"Total legal factura: C${float(sale.get('total_legal') or sale.get('total') or 0.0):,.2f}",
        f"Neto a cobrar: C${float(sale.get('net_to_collect') or sale.get('total') or 0.0):,.2f}",
        "",
        "Documento generado automáticamente por ERP.",
    ]
    y = 730
    for line in lines:
        c.drawString(50, y, line)
        y -= 18
    c.showPage()
    c.save()
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes