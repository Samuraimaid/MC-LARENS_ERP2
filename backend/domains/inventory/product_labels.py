from __future__ import annotations

from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from typing import Any, Dict, List, Optional

from reportlab.graphics.barcode import code128
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

from backend.domains.export.pdf_documents import TOPCAR_BRANCH_IDS, _resolve_header_logo_path, load_logo_image

LABEL_TEMPLATES: Dict[str, Dict[str, Any]] = {
    "col_50x100": {
        "id": "col_50x100",
        "label": "Horizontal 50 × 100 mm (rollo actual)",
        "shape": "rect",
        "width_mm": 100,
        "height_mm": 50,
        "roll_width_mm": 50,
        "roll_length_mm": 100,
        "layout": "card",
        "columns": 1,
    },
    "card_60x40": {
        "id": "card_60x40",
        "label": "Tarjeta 60 × 40 mm",
        "shape": "rect",
        "width_mm": 60,
        "height_mm": 40,
        "layout": "card",
    },
    "rect_50x30": {
        "id": "rect_50x30",
        "label": "Rectangular 50 × 30 mm",
        "shape": "rect",
        "width_mm": 50,
        "height_mm": 30,
        "layout": "card",
    },
    "rect_40x25": {
        "id": "rect_40x25",
        "label": "Rectangular 40 × 25 mm",
        "shape": "rect",
        "width_mm": 40,
        "height_mm": 25,
        "layout": "card",
    },
    "rect_60x40": {
        "id": "rect_60x40",
        "label": "Rectangular 60 × 40 mm",
        "shape": "rect",
        "width_mm": 60,
        "height_mm": 40,
        "layout": "card",
    },
    "round_40": {
        "id": "round_40",
        "label": "Circular 40 mm",
        "shape": "round",
        "width_mm": 40,
        "height_mm": 40,
        "layout": "round",
    },
}

PRINTER_PROFILES: Dict[str, Dict[str, Any]] = {
    "xprinter_xp460b": {
        "id": "xprinter_xp460b",
        "label": "Xprinter XP-460B",
        "driver": "Xprinter XP-460B",
        "language": "TSPL",
        "max_width_mm": 104,
        "default_template_id": "col_50x100",
        "notes": "Impresora térmica monocromática 50×100 mm. Impresión directa USB vía puente local.",
    },
    "browser_pdf": {
        "id": "browser_pdf",
        "label": "PDF / Imprimir desde navegador",
        "driver": "PDF",
        "language": "PDF",
        "max_width_mm": 120,
        "default_template_id": "card_60x40",
        "notes": "Vista previa e impresión universal en monocromo.",
    },
}

LABEL_STYLE = {
    "ink": "#111111",
    "muted": "#5C5C5C",
    "border": "#1A1A1A",
    "panel": "#F3F3F3",
    "divider": "#CFCFCF",
    "badge_fill": "#E8E8E8",
    "badge_ink": "#222222",
}


def resolve_product_barcode(product: Dict[str, Any]) -> str:
    for key in ("barcode", "ean", "upc", "sku"):
        value = str(product.get(key) or "").strip()
        if value:
            return value
    return str(product.get("product_id") or "").strip()


def resolve_roll_dimensions(template: Dict[str, Any]) -> tuple[int, int]:
    width_mm = int(round(float(template.get("roll_width_mm") or template.get("width_mm") or 50)))
    height_mm = int(round(float(template.get("roll_length_mm") or template.get("height_mm") or 100)))
    return max(20, min(120, width_mm)), max(15, min(150, height_mm))


def resolve_template(template_id: str, overrides: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    base = LABEL_TEMPLATES.get(template_id) or LABEL_TEMPLATES["col_50x100"]
    data = dict(base)
    overrides = overrides or {}
    if overrides.get("width_mm"):
        data["width_mm"] = max(20, min(120, float(overrides["width_mm"])))
    if overrides.get("height_mm"):
        data["height_mm"] = max(15, min(150, float(overrides["height_mm"])))
    if overrides.get("shape") in {"rect", "round"}:
        data["shape"] = overrides["shape"]
        if data["shape"] == "round":
            data["layout"] = "round"
        elif data.get("layout") not in {"round", "column"}:
            data["layout"] = "card"
    return data


def _truncate_text(value: str, limit: int) -> str:
    text = str(value or "").strip()
    if len(text) <= limit:
        return text
    return f"{text[: max(0, limit - 1)]}…"


def _wrap_text(value: str, font_name: str, font_size: float, max_width: float, c: canvas.Canvas, max_lines: int = 2) -> List[str]:
    words = str(value or "").strip().split()
    if not words:
        return [""]

    lines: List[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if c.stringWidth(candidate, font_name, font_size) <= max_width:
            current = candidate
            continue
        if current:
            lines.append(current)
        current = word
        if len(lines) >= max_lines:
            break

    if current and len(lines) < max_lines:
        lines.append(current)

    if len(lines) > max_lines:
        lines = lines[:max_lines]

    if len(lines) == max_lines and " ".join(words) != " ".join(lines):
        last = lines[-1]
        while last and c.stringWidth(f"{last}…", font_name, font_size) > max_width:
            last = last[:-1]
        lines[-1] = f"{last}…" if last else "…"

    return lines or [""]


def _branding_assets_dir() -> Path:
    backend_dir = Path(__file__).resolve().parents[2]
    packaged = backend_dir / "assets" / "branding"
    if packaged.exists():
        return packaged
    return backend_dir.parent / "frontend" / "public"


def resolve_label_brand_id(branch: Optional[Dict[str, Any]]) -> str:
    branch_id = str((branch or {}).get("branch_id") or "").strip()
    return "topcar" if branch_id in TOPCAR_BRANCH_IDS else "mundo"


def _is_topcar_branch(branch: Optional[Dict[str, Any]]) -> bool:
    return resolve_label_brand_id(branch) == "topcar"


def resolve_label_branch_name(branch: Optional[Dict[str, Any]]) -> str:
    data = branch or {}
    return str(data.get("company_name") or data.get("name") or "Sucursal").strip()


def _resolve_label_logo_path(
    branch_id: str = "",
    logo_url: str = "",
    branch: Optional[Dict[str, Any]] = None,
) -> str:
    if logo_url and (
        logo_url.startswith("http://")
        or logo_url.startswith("https://")
        or logo_url.startswith("data:image")
        or Path(logo_url).exists()
    ):
        return logo_url

    resolved_branch_id = str(branch_id or (branch or {}).get("branch_id") or "").strip()
    brand_id = str((branch or {}).get("brand_id") or "").strip()
    use_topcar = brand_id == "topcar" or _is_topcar_branch({"branch_id": resolved_branch_id, **(branch or {})})

    branding = _branding_assets_dir()
    preset = "topcar-logo-label.png" if use_topcar else "mundo-logo-label.png"
    label_logo = branding / preset
    if label_logo.exists():
        return str(label_logo)

    fallback = "topcar-logo.png" if use_topcar else "mundo-logo.png"
    fallback_path = branding / fallback
    if fallback_path.exists():
        return str(fallback_path)

    company = {"branch_id": resolved_branch_id, "logo_url": logo_url}
    return _resolve_header_logo_path(company)


def _draw_fitted_logo(
    pdf: canvas.Canvas,
    logo_reader: ImageReader,
    *,
    x: float,
    y: float,
    max_width: float,
    max_height: float,
) -> None:
    try:
        image_width, image_height = logo_reader.getSize()
    except Exception:
        image_width, image_height = (1, 1)

    if image_width <= 0 or image_height <= 0:
        return

    scale = min(max_width / float(image_width), max_height / float(image_height))
    draw_width = float(image_width) * scale
    draw_height = float(image_height) * scale
    draw_x = x + ((max_width - draw_width) / 2.0)
    draw_y = y + ((max_height - draw_height) / 2.0)
    pdf.drawImage(
        logo_reader,
        draw_x,
        draw_y,
        width=draw_width,
        height=draw_height,
        preserveAspectRatio=True,
        anchor="sw",
        mask="auto",
    )


def _build_tspl_bitmap_lines(
    logo_path: str,
    *,
    x: int,
    y: int,
    max_width_dots: int,
    max_height_dots: int,
) -> List[str]:
    path = Path(logo_path)
    if not path.exists():
        return []

    try:
        from PIL import Image, ImageOps
    except ImportError:
        return []

    try:
        image = Image.open(path)
        rgba = image.convert("RGBA")
        gray = ImageOps.grayscale(rgba)
        gray = ImageOps.autocontrast(gray, cutoff=1)
        mono = gray.point(lambda value: 0 if value < 210 else 255, mode="1")
        mono.thumbnail((max(8, max_width_dots), max(8, max_height_dots)), Image.LANCZOS)

        width, height = mono.size
        if width <= 0 or height <= 0:
            return []

        width_bytes = (width + 7) // 8
        pixels = list(mono.getdata())
        data_bytes = bytearray()
        for row in range(height):
            for byte_col in range(width_bytes):
                byte_val = 0
                for bit in range(8):
                    px_x = byte_col * 8 + bit
                    if px_x < width and pixels[(row * width) + px_x] == 0:
                        byte_val |= 1 << (7 - bit)
                data_bytes.append(byte_val)

        hex_data = "".join(f"{byte:02X}" for byte in data_bytes)
        if not hex_data:
            return []
        return [f"BITMAP {x},{y},{width_bytes},{height},0,{hex_data}"]
    except Exception:
        return []


def _prepare_monochrome_logo(logo_reader: Any, logger: Any = None) -> Optional[ImageReader]:
    if not logo_reader:
        return None
    try:
        from PIL import Image, ImageOps

        image = Image.open(logo_reader)
        rgba = image.convert("RGBA")
        gray = ImageOps.grayscale(rgba)
        gray = ImageOps.autocontrast(gray, cutoff=1)
        mono = gray.point(lambda value: 0 if value < 210 else 255, mode="1")
        buffer = BytesIO()
        mono.convert("RGBA").save(buffer, format="PNG")
        buffer.seek(0)
        return ImageReader(buffer)
    except Exception:
        if logger:
            logger.exception("Failed to prepare monochrome logo")
        return logo_reader if isinstance(logo_reader, ImageReader) else None


def _draw_rounded_rect(
    c: canvas.Canvas,
    x: float,
    y: float,
    width: float,
    height: float,
    radius: float,
    *,
    fill: Optional[str] = None,
    stroke: Optional[str] = None,
    stroke_width: float = 0.6,
) -> None:
    radius = min(radius, width / 2.0, height / 2.0)
    path = c.beginPath()
    path.moveTo(x + radius, y)
    path.lineTo(x + width - radius, y)
    path.arcTo(x + width - radius, y, x + width, y + radius, radius)
    path.lineTo(x + width, y + height - radius)
    path.arcTo(x + width, y + height - radius, x + width - radius, y + height, radius)
    path.lineTo(x + radius, y + height)
    path.arcTo(x + radius, y + height, x, y + height - radius, radius)
    path.lineTo(x, y + radius)
    path.arcTo(x, y + radius, x + radius, y, radius)
    path.close()

    if fill:
        c.setFillColor(colors.HexColor(fill))
    if stroke:
        c.setStrokeColor(colors.HexColor(stroke))
        c.setLineWidth(stroke_width)

    if fill and stroke:
        c.drawPath(path, stroke=1, fill=1)
    elif fill:
        c.drawPath(path, stroke=0, fill=1)
    else:
        c.drawPath(path, stroke=1, fill=0)


def _draw_round_clip(c: canvas.Canvas, width: float, height: float) -> None:
    radius = min(width, height) / 2.0
    path = c.beginPath()
    path.circle(width / 2.0, height / 2.0, radius)
    c.clipPath(path, stroke=0, fill=0)


def _scaled_font_sizes(height_mm: float) -> Dict[str, float]:
    scale = max(0.72, min(1.18, height_mm / 40.0))
    return {
        "title": 7.2 * scale,
        "meta": 5.4 * scale,
        "sku": 5.8 * scale,
        "price": 7.4 * scale,
        "badge": 4.8 * scale,
        "barcode_human": 5.2 * scale,
    }


def build_label_payload(
    *,
    product: Dict[str, Any],
    branch: Dict[str, Any],
    warehouse: Dict[str, Any],
    template: Dict[str, Any],
    quantity: int = 1,
    show_price: bool = True,
) -> Dict[str, Any]:
    barcode_value = resolve_product_barcode(product)
    return {
        "product_id": product.get("product_id"),
        "sku": product.get("sku"),
        "barcode": barcode_value,
        "name": product.get("name"),
        "price": product.get("price"),
        "branch_id": branch.get("branch_id"),
        "brand_id": resolve_label_brand_id(branch),
        "branch_name": resolve_label_branch_name(branch),
        "warehouse_id": warehouse.get("warehouse_id"),
        "warehouse_name": warehouse.get("name"),
        "template": template,
        "quantity": max(1, min(int(quantity or 1), 500)),
        "show_price": bool(show_price),
        "printed_at": datetime.now(timezone.utc).isoformat(),
    }


def _draw_card_label_page(
    pdf: canvas.Canvas,
    *,
    width: float,
    height: float,
    template: Dict[str, Any],
    label: Dict[str, Any],
    logo_reader: Optional[ImageReader],
) -> None:
    width_mm = float(template.get("width_mm", 60))
    height_mm = float(template.get("height_mm", 40))
    landscape = width_mm > height_mm
    fonts = _scaled_font_sizes(max(width_mm, height_mm) if landscape else height_mm)
    margin = 1.4 * mm
    radius = min(2.4 * mm, width * 0.05, height * 0.08)

    pdf.saveState()
    if template.get("shape") == "round":
        _draw_round_clip(pdf, width, height)

    _draw_rounded_rect(
        pdf,
        margin,
        margin,
        width - (2 * margin),
        height - (2 * margin),
        radius,
        fill=LABEL_STYLE["panel"],
        stroke=LABEL_STYLE["border"],
        stroke_width=0.75,
    )

    inner_x = margin + 1.0 * mm
    inner_y = margin + 1.0 * mm
    inner_w = width - (2 * margin) - (2.0 * mm)
    inner_h = height - (2 * margin) - (2.0 * mm)

    footer_h = min(inner_h * (0.30 if height_mm >= 80 else 0.36), 22 * mm if height_mm >= 80 else 12.5 * mm)
    body_h = inner_h - footer_h
    logo_w = min(inner_w * 0.34, 16 * mm)
    logo_w = min(logo_w, body_h * 0.88)
    content_x = inner_x + logo_w + 1.4 * mm
    content_w = max(inner_x + 8 * mm, inner_x + inner_w - logo_w - 1.4 * mm) - content_x

    pdf.setStrokeColor(colors.HexColor(LABEL_STYLE["divider"]))
    pdf.setLineWidth(0.45)
    pdf.line(inner_x + logo_w + 0.6 * mm, inner_y + footer_h + 0.8 * mm, inner_x + logo_w + 0.6 * mm, inner_y + inner_h - 0.8 * mm)

    if logo_reader:
        logo_x = inner_x + 0.6 * mm
        logo_y = inner_y + footer_h + 0.5 * mm
        _draw_fitted_logo(
            pdf,
            logo_reader,
            x=logo_x,
            y=logo_y,
            max_width=logo_w - 1.2 * mm,
            max_height=body_h - 1.0 * mm,
        )
    else:
        pdf.setFont("Helvetica-Bold", fonts["badge"])
        pdf.setFillColor(colors.HexColor(LABEL_STYLE["muted"]))
        branch_short = _truncate_text(label.get("branch_name"), 10)
        pdf.drawCentredString(inner_x + (logo_w / 2.0), inner_y + footer_h + (body_h / 2.0), branch_short or "MC")

    product_name = str(label.get("name") or "Producto")
    sku = _truncate_text(label.get("sku"), 24)
    branch_name = _truncate_text(label.get("branch_name"), 18)
    warehouse_name = _truncate_text(label.get("warehouse_name"), 18)
    barcode_value = str(label.get("barcode") or label.get("sku") or "")

    title_lines = _wrap_text(product_name, "Helvetica-Bold", fonts["title"], content_w, pdf, max_lines=2)
    title_y = inner_y + inner_h - 1.1 * mm
    pdf.setFont("Helvetica-Bold", fonts["title"])
    pdf.setFillColor(colors.HexColor(LABEL_STYLE["ink"]))
    for line in title_lines:
        pdf.drawString(content_x, title_y - fonts["title"], line)
        title_y -= fonts["title"] + 0.5 * mm

    pdf.setFont("Helvetica", fonts["sku"])
    pdf.setFillColor(colors.HexColor(LABEL_STYLE["muted"]))
    sku_y = inner_y + footer_h + body_h - (len(title_lines) * (fonts["title"] + 0.5 * mm)) - 2.0 * mm
    pdf.drawString(content_x, sku_y, sku or "SKU —")

    if label.get("show_price"):
        try:
            price = float(label.get("price") or 0)
        except (TypeError, ValueError):
            price = 0.0
        pdf.setFont("Helvetica-Bold", fonts["price"])
        pdf.setFillColor(colors.HexColor(LABEL_STYLE["ink"]))
        pdf.drawRightString(inner_x + inner_w - 0.4 * mm, inner_y + inner_h - 1.2 * mm, f"${price:,.2f}")

    badge_y = inner_y + footer_h + 1.0 * mm
    badge_text = branch_name or "Sucursal"
    badge_pad_x = 1.2 * mm
    badge_pad_y = 0.55 * mm
    pdf.setFont("Helvetica-Bold", fonts["badge"])
    badge_w = pdf.stringWidth(badge_text, "Helvetica-Bold", fonts["badge"]) + (2 * badge_pad_x)
    badge_h = fonts["badge"] + (2 * badge_pad_y)
    _draw_rounded_rect(
        pdf,
        content_x,
        badge_y,
        min(badge_w, content_w * 0.62),
        badge_h,
        min(1.0 * mm, badge_h / 2.0),
        fill=LABEL_STYLE["badge_fill"],
        stroke=LABEL_STYLE["divider"],
        stroke_width=0.35,
    )
    pdf.setFillColor(colors.HexColor(LABEL_STYLE["badge_ink"]))
    pdf.drawString(content_x + badge_pad_x, badge_y + badge_pad_y, badge_text)

    pdf.setFont("Helvetica", fonts["meta"])
    pdf.setFillColor(colors.HexColor(LABEL_STYLE["muted"]))
    warehouse_x = content_x + min(badge_w, content_w * 0.62) + 1.0 * mm
    pdf.drawString(warehouse_x, badge_y + badge_pad_y + 0.1 * mm, warehouse_name or "Bodega")

    pdf.setStrokeColor(colors.HexColor(LABEL_STYLE["divider"]))
    pdf.setLineWidth(0.4)
    pdf.line(inner_x + 0.5 * mm, inner_y + footer_h, inner_x + inner_w - 0.5 * mm, inner_y + footer_h)

    if barcode_value:
        barcode_height = min(footer_h * 0.58, 8.8 * mm)
        barcode_bottom = inner_y + 1.3 * mm
        barcode = code128.Code128(barcode_value, barHeight=barcode_height, barWidth=0.33)
        barcode_x = inner_x + ((inner_w - barcode.width) / 2.0)
        barcode.drawOn(pdf, max(inner_x + 0.6 * mm, barcode_x), barcode_bottom)
        pdf.setFont("Helvetica", fonts["barcode_human"])
        pdf.setFillColor(colors.HexColor(LABEL_STYLE["ink"]))
        pdf.drawCentredString(inner_x + (inner_w / 2.0), inner_y + 0.35 * mm, barcode_value)

    pdf.restoreState()


def _draw_column_label_page(
    pdf: canvas.Canvas,
    *,
    width: float,
    height: float,
    template: Dict[str, Any],
    label: Dict[str, Any],
    logo_reader: Optional[ImageReader],
) -> None:
    height_mm = float(template.get("height_mm", 100))
    fonts = _scaled_font_sizes(height_mm)
    margin = 1.6 * mm
    radius = min(2.8 * mm, width * 0.06, height * 0.03)

    pdf.saveState()
    _draw_rounded_rect(
        pdf,
        margin,
        margin,
        width - (2 * margin),
        height - (2 * margin),
        radius,
        fill=LABEL_STYLE["panel"],
        stroke=LABEL_STYLE["border"],
        stroke_width=0.8,
    )

    inner_x = margin + 1.2 * mm
    inner_y = margin + 1.2 * mm
    inner_w = width - (2 * margin) - (2.4 * mm)
    inner_h = height - (2 * margin) - (2.4 * mm)
    footer_h = min(inner_h * 0.28, 24 * mm)
    cursor_y = inner_y + inner_h

    if logo_reader:
        logo_size = min(inner_w * 0.42, 18 * mm)
        cursor_y -= logo_size + 1.2 * mm
        pdf.drawImage(
            logo_reader,
            inner_x + ((inner_w - logo_size) / 2.0),
            cursor_y,
            width=logo_size,
            height=logo_size,
            preserveAspectRatio=True,
            anchor="c",
            mask="auto",
        )
        cursor_y -= 1.0 * mm

    branch_name = _truncate_text(label.get("branch_name"), 22)
    warehouse_name = _truncate_text(label.get("warehouse_name"), 22)
    badge_text = f"{branch_name} · {warehouse_name}".strip(" ·")
    badge_pad_x = 1.4 * mm
    badge_pad_y = 0.7 * mm
    pdf.setFont("Helvetica-Bold", fonts["badge"])
    badge_w = min(pdf.stringWidth(badge_text, "Helvetica-Bold", fonts["badge"]) + (2 * badge_pad_x), inner_w)
    badge_h = fonts["badge"] + (2 * badge_pad_y)
    cursor_y -= badge_h
    _draw_rounded_rect(
        pdf,
        inner_x + ((inner_w - badge_w) / 2.0),
        cursor_y,
        badge_w,
        badge_h,
        min(1.1 * mm, badge_h / 2.0),
        fill=LABEL_STYLE["badge_fill"],
        stroke=LABEL_STYLE["divider"],
        stroke_width=0.35,
    )
    pdf.setFillColor(colors.HexColor(LABEL_STYLE["badge_ink"]))
    pdf.drawCentredString(inner_x + (inner_w / 2.0), cursor_y + badge_pad_y, badge_text)
    cursor_y -= 2.0 * mm

    product_name = str(label.get("name") or "Producto")
    title_lines = _wrap_text(product_name, "Helvetica-Bold", fonts["title"], inner_w, pdf, max_lines=3)
    pdf.setFont("Helvetica-Bold", fonts["title"])
    pdf.setFillColor(colors.HexColor(LABEL_STYLE["ink"]))
    for line in title_lines:
        cursor_y -= fonts["title"] + 0.6 * mm
        pdf.drawCentredString(inner_x + (inner_w / 2.0), cursor_y, line)

    sku = _truncate_text(label.get("sku"), 28)
    cursor_y -= fonts["sku"] + 1.4 * mm
    pdf.setFont("Helvetica", fonts["sku"])
    pdf.setFillColor(colors.HexColor(LABEL_STYLE["muted"]))
    pdf.drawCentredString(inner_x + (inner_w / 2.0), cursor_y, f"SKU: {sku or '—'}")

    if label.get("show_price"):
        try:
            price = float(label.get("price") or 0)
        except (TypeError, ValueError):
            price = 0.0
        cursor_y -= fonts["price"] + 1.8 * mm
        pdf.setFont("Helvetica-Bold", fonts["price"] + 1.2)
        pdf.setFillColor(colors.HexColor(LABEL_STYLE["ink"]))
        pdf.drawCentredString(inner_x + (inner_w / 2.0), cursor_y, f"${price:,.2f}")

    pdf.setStrokeColor(colors.HexColor(LABEL_STYLE["divider"]))
    pdf.setLineWidth(0.45)
    footer_top = inner_y + footer_h
    pdf.line(inner_x + 0.6 * mm, footer_top, inner_x + inner_w - 0.6 * mm, footer_top)

    barcode_value = str(label.get("barcode") or label.get("sku") or "")
    if barcode_value:
        barcode_height = min(footer_h * 0.52, 14 * mm)
        barcode_bottom = inner_y + 2.0 * mm
        barcode = code128.Code128(barcode_value, barHeight=barcode_height, barWidth=0.36)
        barcode_x = inner_x + ((inner_w - barcode.width) / 2.0)
        barcode.drawOn(pdf, max(inner_x + 0.8 * mm, barcode_x), barcode_bottom)
        pdf.setFont("Helvetica", fonts["barcode_human"])
        pdf.setFillColor(colors.HexColor(LABEL_STYLE["ink"]))
        pdf.drawCentredString(inner_x + (inner_w / 2.0), inner_y + 0.5 * mm, barcode_value)

    pdf.restoreState()


def _draw_round_label_page(
    pdf: canvas.Canvas,
    *,
    width: float,
    height: float,
    label: Dict[str, Any],
    logo_reader: Optional[ImageReader],
) -> None:
    fonts = _scaled_font_sizes(float(label.get("template", {}).get("height_mm", 40)))
    margin = 2.0 * mm

    pdf.saveState()
    _draw_round_clip(pdf, width, height)
    pdf.setStrokeColor(colors.HexColor(LABEL_STYLE["border"]))
    pdf.setLineWidth(0.8)
    pdf.circle(width / 2.0, height / 2.0, min(width, height) / 2.0 - margin, stroke=1, fill=0)

    if logo_reader:
        logo_size = min(width, height) * 0.22
        pdf.drawImage(
            logo_reader,
            (width - logo_size) / 2.0,
            height - margin - logo_size - 1.0 * mm,
            width=logo_size,
            height=logo_size,
            preserveAspectRatio=True,
            anchor="c",
            mask="auto",
        )

    product_name = _truncate_text(label.get("name"), 24)
    sku = _truncate_text(label.get("sku"), 16)
    barcode_value = str(label.get("barcode") or label.get("sku") or "")

    pdf.setFont("Helvetica-Bold", fonts["title"])
    pdf.setFillColor(colors.HexColor(LABEL_STYLE["ink"]))
    pdf.drawCentredString(width / 2.0, height * 0.52, product_name)
    pdf.setFont("Helvetica", fonts["sku"])
    pdf.setFillColor(colors.HexColor(LABEL_STYLE["muted"]))
    pdf.drawCentredString(width / 2.0, height * 0.44, sku)

    if barcode_value:
        barcode_height = min(height * 0.18, 7.5 * mm)
        barcode = code128.Code128(barcode_value, barHeight=barcode_height, barWidth=0.3)
        barcode_x = (width - barcode.width) / 2.0
        barcode.drawOn(pdf, max(margin, barcode_x), margin + 2.0 * mm)

    pdf.restoreState()


def render_labels_pdf(label: Dict[str, Any], logo_path: str = "", logger: Any = None) -> bytes:
    template = label.get("template") or LABEL_TEMPLATES["card_60x40"]
    width = float(template.get("width_mm", 60)) * mm
    height = float(template.get("height_mm", 40)) * mm
    copies = int(label.get("quantity") or 1)
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=(width, height))

    branch_id = str(label.get("branch_id") or "").strip()
    branch = {
        "branch_id": branch_id,
        "brand_id": label.get("brand_id"),
        "company_name": label.get("branch_name"),
        "name": label.get("branch_name"),
    }
    resolved_logo_path = _resolve_label_logo_path(branch_id, str(logo_path or ""), branch=branch)
    raw_logo = load_logo_image(resolved_logo_path, logger)
    logo_reader = _prepare_monochrome_logo(raw_logo, logger)

    for copy_index in range(copies):
        if copy_index > 0:
            pdf.showPage()

        layout = template.get("layout")
        if template.get("shape") == "round" or layout == "round":
            _draw_round_label_page(pdf, width=width, height=height, label=label, logo_reader=logo_reader)
        elif layout == "column":
            _draw_column_label_page(
                pdf,
                width=width,
                height=height,
                template=template,
                label=label,
                logo_reader=logo_reader,
            )
        else:
            _draw_card_label_page(
                pdf,
                width=width,
                height=height,
                template=template,
                label=label,
                logo_reader=logo_reader,
            )

    pdf.save()
    buffer.seek(0)
    return buffer.getvalue()


def _tspl_escape(value: str) -> str:
    cleaned = (
        str(value or "")
        .replace('"', "'")
        .replace("\r", " ")
        .replace("\n", " ")
        .replace("…", "...")
    )
    return cleaned.encode("ascii", "ignore").decode("ascii")


def _pdf_page_to_mono_image(pdf_bytes: bytes, *, dpi: int = 203):
    import fitz
    from PIL import Image, ImageOps

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        page = doc[0]
        pix = page.get_pixmap(dpi=dpi, colorspace=fitz.csGRAY)
        gray = Image.frombytes("L", (pix.width, pix.height), pix.samples)
    finally:
        doc.close()

    gray = ImageOps.autocontrast(gray, cutoff=1)
    return gray.point(lambda value: 0 if value < 180 else 255, mode="1")


def _mono_image_to_tspl_bitmap(image) -> tuple[int, int, bytes]:
    from PIL import Image

    bw = image.convert("1")
    width, height = bw.size
    width_bytes = (width + 7) // 8
    packed = bw.tobytes()
    pillow_stride = (width + 7) // 8
    if pillow_stride == width_bytes and len(packed) == width_bytes * height:
        return width_bytes, height, packed

    aligned = bytearray(width_bytes * height)
    for row in range(height):
        src_offset = row * pillow_stride
        dst_offset = row * width_bytes
        copy_len = min(pillow_stride, width_bytes)
        aligned[dst_offset : dst_offset + copy_len] = packed[src_offset : src_offset + copy_len]
    return width_bytes, height, bytes(aligned)


def _build_tspl_bitmap_job(
    image,
    *,
    width_mm: int,
    height_mm: int,
    copies: int = 1,
    gap_mm: int = 2,
    density: int = 12,
    speed: int = 4,
) -> bytes:
    width_bytes, height, bitmap_data = _mono_image_to_tspl_bitmap(image)
    parts = [
        f"SIZE {width_mm} mm, {height_mm} mm\r\n".encode("ascii"),
        f"GAP {gap_mm} mm, 0 mm\r\n".encode("ascii"),
        b"DIRECTION 0\r\n",
        b"REFERENCE 0,0\r\n",
        f"DENSITY {max(0, min(15, density))}\r\n".encode("ascii"),
        f"SPEED {max(1, min(5, speed))}\r\n".encode("ascii"),
        b"SET TEAR ON\r\n",
        b"CLS\r\n",
        f"BITMAP 0,0,{width_bytes},{height},0,".encode("ascii"),
        bitmap_data,
        f"\r\nPRINT {max(1, int(copies or 1))},1\r\n".encode("ascii"),
    ]
    return b"".join(parts)


def render_labels_tspl_bytes(
    label: Dict[str, Any],
    logo_path: str = "",
    logger: Any = None,
    *,
    printer_id: str = "xprinter_xp460b",
) -> bytes:
    template = label.get("template") or LABEL_TEMPLATES["col_50x100"]
    width_mm, height_mm = resolve_roll_dimensions(template)
    roll_template = dict(template)
    roll_template["width_mm"] = width_mm
    roll_template["height_mm"] = height_mm

    label_for_roll = dict(label)
    label_for_roll["template"] = roll_template
    label_for_roll["quantity"] = 1

    pdf_bytes = render_labels_pdf(label_for_roll, logo_path=logo_path, logger=logger)
    mono = _pdf_page_to_mono_image(pdf_bytes, dpi=203)

    from PIL import Image

    target_w = width_mm * 8
    target_h = height_mm * 8
    if mono.size != (target_w, target_h):
        mono = mono.resize((target_w, target_h), Image.LANCZOS)
        mono = mono.point(lambda value: 0 if value < 180 else 255, mode="1")

    copies = int(label.get("quantity") or 1)
    profile = PRINTER_PROFILES.get(printer_id) or PRINTER_PROFILES["xprinter_xp460b"]
    _ = profile
    return _build_tspl_bitmap_job(
        mono,
        width_mm=width_mm,
        height_mm=height_mm,
        copies=copies,
    )


def render_labels_tspl(label: Dict[str, Any], printer_id: str = "xprinter_xp460b") -> str:
    template = label.get("template") or LABEL_TEMPLATES["col_50x100"]
    width_mm, height_mm = resolve_roll_dimensions(template)
    copies = int(label.get("quantity") or 1)
    profile = PRINTER_PROFILES.get(printer_id) or PRINTER_PROFILES["xprinter_xp460b"]
    return "\r\n".join(
        [
            f"; TSPL bitmap mode {width_mm}x{height_mm} for {profile.get('label', printer_id)}",
            f"; Binary payload via render_labels_tspl_bytes() ({width_mm * 8}x{height_mm * 8} dots)",
            f"SIZE {width_mm} mm, {height_mm} mm",
            f"PRINT {copies},1",
            "",
        ]
    )


def _label_branch_for_logo(label: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "branch_id": label.get("branch_id"),
        "brand_id": label.get("brand_id"),
        "company_name": label.get("branch_name"),
        "name": label.get("branch_name"),
    }


def _brand_logo_caption(label: Dict[str, Any]) -> str:
    brand_id = str(label.get("brand_id") or resolve_label_brand_id(_label_branch_for_logo(label)))
    if brand_id == "topcar":
        return "TOPCAR"
    return "MUNDO"


def _render_labels_tspl_card(
    label: Dict[str, Any],
    printer_id: str = "xprinter_xp460b",
    logo_path: str = "",
) -> str:
    template = label.get("template") or LABEL_TEMPLATES["card_60x40"]
    width_mm, height_mm = resolve_roll_dimensions(template)
    copies = int(label.get("quantity") or 1)
    barcode_value = _tspl_escape(str(label.get("barcode") or label.get("sku") or ""))
    tall_label = height_mm >= 80
    name_limit = 28 if tall_label else 26
    product_name = _tspl_escape(_truncate_text(label.get("name"), name_limit))
    branch_name = _tspl_escape(_truncate_text(label.get("branch_name"), 16))
    warehouse_name = _tspl_escape(_truncate_text(label.get("warehouse_name"), 16))
    sku = _tspl_escape(_truncate_text(label.get("sku"), 18))
    brand_caption = _tspl_escape(_brand_logo_caption(label))

    margin = 12
    box_right = max(20, int(width_mm * 8) - margin)
    box_bottom = max(20, int(height_mm * 8) - margin)
    divider_x = margin + int((box_right - margin) * 0.34)
    footer_top = margin + int((box_bottom - margin) * (0.70 if tall_label else 0.64))
    content_x = divider_x + 10
    logo_center_x = margin + int((divider_x - margin) / 2)
    body_top = margin + 8

    lines = [
        f"SIZE {width_mm} mm,{height_mm} mm",
        "GAP 2 mm,0 mm",
        "DIRECTION 1",
        "REFERENCE 0,0",
        "CLS",
        f"BOX {margin},{margin},{box_right},{box_bottom},2",
        f"BAR {margin},{footer_top},{box_right},{footer_top}",
        f"BAR {divider_x},{margin},{divider_x},{box_bottom}",
        f'TEXT {logo_center_x},{body_top + 48},"4",0,1,1,"{brand_caption}"',
        f'TEXT {content_x},{body_top},"3",0,1,1,"{product_name}"',
        f'TEXT {content_x},{body_top + 40},"2",0,1,1,"SKU: {sku}"',
        f'TEXT {content_x},{body_top + 78},"1",0,1,1,"{branch_name}"',
        f'TEXT {content_x},{body_top + 102},"1",0,1,1,"{warehouse_name}"',
    ]

    if label.get("show_price"):
        try:
            price = float(label.get("price") or 0)
        except (TypeError, ValueError):
            price = 0.0
        price_text = _tspl_escape(f"${price:,.2f}")
        lines.append(f'TEXT {content_x},{body_top + 132},"3",0,1,1,"{price_text}"')

    if barcode_value:
        barcode_height = 72 if tall_label else 56
        barcode_y = footer_top + 12
        barcode_x = margin + 8
        lines.append(f'BARCODE {barcode_x},{barcode_y},"128",{barcode_height},1,0,2,4,"{barcode_value}"')
        lines.append(
            f'TEXT {barcode_x},{min(box_bottom - 14, barcode_y + barcode_height + 8)},"1",0,1,1,"{barcode_value}"'
        )

    lines.append(f"PRINT {copies},1")
    profile = PRINTER_PROFILES.get(printer_id) or PRINTER_PROFILES["xprinter_xp460b"]
    header = f"; TSPL horizontal card roll {width_mm}x{height_mm} for {profile.get('label', printer_id)}"
    return "\r\n".join([header, *lines, ""])


def _render_labels_tspl_column(label: Dict[str, Any], printer_id: str = "xprinter_xp460b") -> str:
    template = label.get("template") or LABEL_TEMPLATES["col_50x100"]
    width_mm, height_mm = resolve_roll_dimensions(template)
    copies = int(label.get("quantity") or 1)
    barcode_value = _tspl_escape(str(label.get("barcode") or label.get("sku") or ""))
    product_name = _tspl_escape(_truncate_text(label.get("name"), 34))
    branch_name = _tspl_escape(_truncate_text(label.get("branch_name"), 20))
    warehouse_name = _tspl_escape(_truncate_text(label.get("warehouse_name"), 20))
    sku = _tspl_escape(_truncate_text(label.get("sku"), 24))

    box_right = max(20, int(width_mm * 8) - 16)
    box_bottom = max(20, int(height_mm * 8) - 16)
    footer_y = int(box_bottom * 0.28)

    lines = [
        f"SIZE {width_mm} mm,{height_mm} mm",
        "GAP 2 mm,0 mm",
        "DIRECTION 1",
        "REFERENCE 0,0",
        "CLS",
        f"BOX 12,12,{box_right},{box_bottom},2",
        f"BAR 12,{footer_y},{box_right},{footer_y}",
        f'TEXT 24,36,"2",0,1,1,"{branch_name} · {warehouse_name}"',
        f'TEXT 24,88,"3",0,1,1,"{product_name}"',
        f'TEXT 24,170,"2",0,1,1,"SKU: {sku}"',
    ]

    if label.get("show_price"):
        try:
            price = float(label.get("price") or 0)
        except (TypeError, ValueError):
            price = 0.0
        price_text = _tspl_escape(f"${price:,.2f}")
        lines.append(f'TEXT 24,220,"4",0,1,1,"{price_text}"')

    if barcode_value:
        lines.append(f'BARCODE 36,{footer_y - 120},"128",96,1,0,2,4,"{barcode_value}"')
        lines.append(f'TEXT 36,{footer_y - 140},"1",0,1,1,"{barcode_value}"')

    lines.append(f"PRINT {copies},1")
    profile = PRINTER_PROFILES.get(printer_id) or PRINTER_PROFILES["xprinter_xp460b"]
    header = f"; TSPL column layout {width_mm}x{height_mm} for {profile.get('label', printer_id)}"
    return "\r\n".join([header, *lines, ""])


def get_label_catalog() -> Dict[str, Any]:
    return {
        "templates": list(LABEL_TEMPLATES.values()),
        "printers": list(PRINTER_PROFILES.values()),
        "default_printer_id": "xprinter_xp460b",
        "default_template_id": "col_50x100",
        "direct_print_supported": True,
        "layout_notes": "Vista PDF horizontal 100×50 mm. Rollo físico 50×100 mm con logo a la izquierda. Impresión USB directa requiere el puente local.",
    }