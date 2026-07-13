"""Hardware-stamped delivery proof watermarks (GPS + timestamp)."""
from __future__ import annotations

from datetime import datetime, timezone
from io import BytesIO
from typing import Optional

from PIL import Image, ImageDraw, ImageFont

WATERMARK_PREFIX = "MC-LARENS ERP"


def _load_font(size: int = 18) -> ImageFont.ImageFont:
    for candidate in (
        "DejaVuSans.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "arial.ttf",
    ):
        try:
            return ImageFont.truetype(candidate, size=size)
        except OSError:
            continue
    return ImageFont.load_default()


def build_watermark_text(
    *,
    latitude: float,
    longitude: float,
    timestamp: Optional[datetime] = None,
) -> str:
    ts = timestamp or datetime.now(timezone.utc)
    local_label = ts.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    return (
        f"{WATERMARK_PREFIX} | {local_label} | "
        f"GPS: LAT {float(latitude):.4f} / LON {float(longitude):.4f}"
    )


def apply_delivery_watermark(
    image_bytes: bytes,
    *,
    latitude: float,
    longitude: float,
    timestamp: Optional[datetime] = None,
    opacity: int = 170,
) -> bytes:
    if not image_bytes:
        raise ValueError("image_bytes vacío")

    base = Image.open(BytesIO(image_bytes)).convert("RGBA")
    overlay = Image.new("RGBA", base.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    font = _load_font(max(14, min(22, base.width // 28)))
    text = build_watermark_text(latitude=latitude, longitude=longitude, timestamp=timestamp)

    margin = max(12, base.width // 80)
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    x = max(margin, base.width - text_w - margin)
    y = max(margin, base.height - text_h - margin)

    pad = 8
    draw.rectangle(
        (x - pad, y - pad, x + text_w + pad, y + text_h + pad),
        fill=(0, 0, 0, min(200, opacity + 20)),
    )
    draw.text((x, y), text, font=font, fill=(255, 255, 255, opacity))

    merged = Image.alpha_composite(base, overlay).convert("RGB")
    out = BytesIO()
    merged.save(out, format="JPEG", quality=88, optimize=True)
    return out.getvalue()