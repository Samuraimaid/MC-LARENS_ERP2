"""Vehicle silhouette thumbnails: storage, resolution, and image processing."""
from __future__ import annotations

import json
import re
import unicodedata
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from typing import Any

from fastapi import HTTPException
from PIL import Image, ImageDraw

from backend.domains.vehicles.type_resolver import (
    TYPE_ALIASES,
    infer_canonical_vehicle_type_label,
    resolve_vehicle_record_slug,
    resolve_vehicle_thumbnail_slug as resolve_slug_from_fields,
)

ROOT = Path(__file__).resolve().parents[2]
BUNDLED_DIR = ROOT / "assets" / "vehicle-thumbnails" / "bundled"
WATERMARK_DIR = ROOT / "assets" / "vehicle-thumbnails" / "watermark"
ACTIVE_DIR = ROOT / "data" / "vehicle-thumbnails" / "active"
WATERMARK_ACTIVE_DIR = ROOT / "data" / "vehicle-thumbnails" / "watermark-active"
MANIFEST_PATH = ROOT / "data" / "vehicle-thumbnails" / "manifest.json"
WATERMARK_SIZE = (640, 360)

CANVAS_SIZE = (640, 360)
THUMBNAIL_INSET = 0.05
BG_TOP = (226, 232, 240)
BG_BOTTOM = (248, 250, 252)
DEFAULT_SLUG = "default"

VEHICLE_THUMBNAIL_CATALOG: list[dict[str, Any]] = [
    {"slug": "hatchback", "label": "Hatchback"},
    {"slug": "sedan", "label": "Sedan"},
    {"slug": "convertible", "label": "Convertible"},
    {"slug": "suv", "label": "SUV"},
    {"slug": "station-wagon", "label": "Station Wagon"},
    {"slug": "camioneta-1-cabina", "label": "Camioneta 1 cabina"},
    {"slug": "camioneta-cabina-y-media", "label": "Camioneta cabina y media"},
    {"slug": "microbus-carga", "label": "Microbús de Carga"},
    {"slug": "microbus-pasajeros", "label": "Microbus de Pasajeros"},
    {"slug": "camion-carga", "label": "Camion de Carga"},
    {"slug": "cabezal", "label": "Cabezal"},
]

ALLOWED_SLUGS = {item["slug"] for item in VEHICLE_THUMBNAIL_CATALOG}
ALLOWED_SLUGS.add(DEFAULT_SLUG)


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalize_vehicle_type_text(value: str = "") -> str:
    text = unicodedata.normalize("NFD", str(value or ""))
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    text = text.strip().lower()
    text = re.sub(r"\s+", " ", text)
    return text


def resolve_vehicle_thumbnail_slug(vehicle_type: str = "", **kwargs: Any) -> str:
    slug = resolve_slug_from_fields(vehicle_type, allow_default=True, **kwargs)
    return slug or DEFAULT_SLUG


def validate_slug(slug: str) -> str:
    safe = str(slug or "").strip().lower()
    if safe not in ALLOWED_SLUGS:
        raise HTTPException(status_code=404, detail=f"Tipo de silueta no soportado: {slug}")
    return safe


def _to_rgba(image: Image.Image) -> Image.Image:
    return image.convert("RGBA") if image.mode != "RGBA" else image


def _trim_ink_bounds(image: Image.Image, pad: int = 8) -> Image.Image:
    rgba = _to_rgba(image)
    width, height = rgba.size
    pixels = rgba.load()
    bounds = None
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if a > 20 and (r + g + b) / 3 < 245:
                if bounds is None:
                    bounds = [x, y, x, y]
                else:
                    bounds[0] = min(bounds[0], x)
                    bounds[1] = min(bounds[1], y)
                    bounds[2] = max(bounds[2], x)
                    bounds[3] = max(bounds[3], y)
    if bounds is None:
        return image
    left = max(0, bounds[0] - pad)
    top = max(0, bounds[1] - pad)
    right = min(width, bounds[2] + pad + 1)
    bottom = min(height, bounds[3] + pad + 1)
    return rgba.crop((left, top, right, bottom))


def _remove_white_background(image: Image.Image, threshold: int = 246) -> Image.Image:
    rgba = _to_rgba(image)
    pixels = rgba.load()
    width, height = rgba.size
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if r >= threshold and g >= threshold and b >= threshold:
                pixels[x, y] = (r, g, b, 0)
    return rgba


def _fit_ink_to_box(ink: Image.Image, max_size: tuple[int, int]) -> Image.Image:
    """Scale ink up or down to fill as much of max_size as possible."""
    max_w, max_h = max_size
    if ink.width <= 0 or ink.height <= 0:
        return ink
    scale = min(max_w / ink.width, max_h / ink.height)
    new_w = max(1, int(round(ink.width * scale)))
    new_h = max(1, int(round(ink.height * scale)))
    if new_w == ink.width and new_h == ink.height:
        return ink
    return ink.resize((new_w, new_h), Image.Resampling.LANCZOS)


def _prepare_ink(ink: Image.Image) -> Image.Image:
    return _remove_white_background(_trim_ink_bounds(ink))


def compose_thumbnail_canvas(
    ink: Image.Image,
    canvas_size: tuple[int, int] = CANVAS_SIZE,
    inset: float = THUMBNAIL_INSET,
) -> Image.Image:
    prepared = _prepare_ink(ink)
    canvas = _make_background(canvas_size)
    max_w = int(canvas_size[0] * (1 - inset * 2))
    max_h = int(canvas_size[1] * (1 - inset * 2))
    fitted = _fit_ink_to_box(prepared, (max_w, max_h))
    x = (canvas_size[0] - fitted.width) // 2
    y = (canvas_size[1] - fitted.height) // 2
    canvas.alpha_composite(fitted, (x, y))
    return canvas.convert("RGBA")


def compose_watermark_canvas(
    ink: Image.Image,
    canvas_size: tuple[int, int] = WATERMARK_SIZE,
    inset: float = THUMBNAIL_INSET,
) -> Image.Image:
    prepared = _prepare_ink(ink)
    canvas = Image.new("RGBA", canvas_size, (0, 0, 0, 0))
    max_w = int(canvas_size[0] * (1 - inset * 2))
    max_h = int(canvas_size[1] * (1 - inset * 2))
    fitted = _fit_ink_to_box(prepared, (max_w, max_h))
    x = canvas_size[0] - fitted.width - int(canvas_size[0] * inset * 0.35)
    y = (canvas_size[1] - fitted.height) // 2
    canvas.alpha_composite(fitted, (x, y))
    return canvas.convert("RGBA")


def _make_background(size: tuple[int, int]) -> Image.Image:
    bg = Image.new("RGBA", size, BG_BOTTOM + (255,))
    draw = ImageDraw.Draw(bg)
    top_r, top_g, top_b = BG_TOP
    bottom_r, bottom_g, bottom_b = BG_BOTTOM
    width, height = size
    for y in range(height):
        ratio = y / max(height - 1, 1)
        r = int(top_r + (bottom_r - top_r) * ratio)
        g = int(top_g + (bottom_g - top_g) * ratio)
        b = int(top_b + (bottom_b - top_b) * ratio)
        draw.line([(0, y), (width, y)], fill=(r, g, b, 255))
    return bg


def process_thumbnail_upload(file_bytes: bytes) -> bytes:
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Archivo vacío")
    try:
        with Image.open(BytesIO(file_bytes)) as src:
            canvas = compose_thumbnail_canvas(src)
            output = BytesIO()
            canvas.save(output, format="PNG", optimize=True)
            return output.getvalue()
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"No se pudo procesar la imagen: {exc}") from exc


def _thumbnail_paths(slug: str, style: str = "card") -> tuple[Path, Path]:
    filename = f"{slug}.png"
    if style == "watermark":
        return WATERMARK_ACTIVE_DIR / filename, WATERMARK_DIR / filename
    return ACTIVE_DIR / filename, BUNDLED_DIR / filename


def get_thumbnail_source(slug: str) -> str:
    safe = validate_slug(slug)
    active_path, bundled_path = _thumbnail_paths(safe)
    if active_path.exists():
        return "active"
    if bundled_path.exists():
        return "bundled"
    if safe != DEFAULT_SLUG:
        return get_thumbnail_source(DEFAULT_SLUG)
    return "missing"


def read_thumbnail_bytes(slug: str, style: str = "card") -> tuple[bytes, str, str]:
    safe = validate_slug(slug)
    normalized_style = "watermark" if str(style or "").lower() == "watermark" else "card"
    active_path, bundled_path = _thumbnail_paths(safe, normalized_style)
    if active_path.exists():
        return active_path.read_bytes(), "image/png", "active"
    if bundled_path.exists():
        return bundled_path.read_bytes(), "image/png", "bundled"
    if normalized_style == "watermark":
        return read_thumbnail_bytes(safe, "card")
    if safe != DEFAULT_SLUG:
        return read_thumbnail_bytes(DEFAULT_SLUG, normalized_style)
    raise HTTPException(status_code=404, detail="Miniatura no encontrada")


def write_active_thumbnail(slug: str, png_bytes: bytes) -> Path:
    safe = validate_slug(slug)
    ACTIVE_DIR.mkdir(parents=True, exist_ok=True)
    path = ACTIVE_DIR / f"{safe}.png"
    path.write_bytes(png_bytes)
    return path


def reset_active_thumbnail(slug: str) -> bool:
    safe = validate_slug(slug)
    path = ACTIVE_DIR / f"{safe}.png"
    if path.exists():
        path.unlink()
        return True
    return False


def load_manifest_file() -> dict[str, Any]:
    if MANIFEST_PATH.exists():
        return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    return {}


def save_manifest_file(manifest: dict[str, Any]) -> None:
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")


def build_public_manifest(settings_doc: dict[str, Any] | None = None) -> dict[str, Any]:
    settings_doc = settings_doc or {}
    overrides = settings_doc.get("overrides") or {}
    assets: dict[str, Any] = {}

    for item in VEHICLE_THUMBNAIL_CATALOG:
        slug = item["slug"]
        source = get_thumbnail_source(slug)
        override = overrides.get(slug) or {}
        assets[slug] = {
            "label": item["label"],
            "slug": slug,
            "source": source,
            "updated_at": override.get("updated_at") or None,
            "url": f"/api/vehicle-thumbnails/{slug}.png",
        }

    default_source = get_thumbnail_source(DEFAULT_SLUG)
    default_override = overrides.get(DEFAULT_SLUG) or {}
    assets[DEFAULT_SLUG] = {
        "label": "Predeterminado",
        "slug": DEFAULT_SLUG,
        "source": default_source,
        "updated_at": default_override.get("updated_at") or None,
        "url": f"/api/vehicle-thumbnails/{DEFAULT_SLUG}.png",
    }

    return {
        "version": 2,
        "default_slug": DEFAULT_SLUG,
        "types": [item["slug"] for item in VEHICLE_THUMBNAIL_CATALOG],
        "type_aliases": TYPE_ALIASES,
        "catalog": VEHICLE_THUMBNAIL_CATALOG,
        "assets": assets,
        "updated_at": settings_doc.get("updated_at"),
    }


def resolve_vehicle_payload(vehicle: dict[str, Any] | None) -> dict[str, Any]:
    vehicle = vehicle or {}
    raw_type = str(
        vehicle.get("vehicle_type")
        or vehicle.get("type")
        or vehicle.get("body_type")
        or ""
    )
    slug = resolve_vehicle_record_slug(vehicle, allow_default=False)
    if not slug:
        inferred_label = infer_canonical_vehicle_type_label(
            raw_type,
            brand=str(vehicle.get("brand") or ""),
            model=str(vehicle.get("model") or ""),
            descriptor=str(vehicle.get("descriptor") or ""),
            body_class=str(vehicle.get("body_class") or vehicle.get("vpic_body_class") or ""),
        )
        return {
            "slug": None,
            "vehicle_type": raw_type or inferred_label,
            "label": inferred_label,
            "url": None,
            "watermark_url": None,
        }

    manifest = build_public_manifest()
    if slug not in manifest.get("assets", {}):
        slug = DEFAULT_SLUG
    asset = manifest["assets"][slug]
    version = asset.get("updated_at") or asset.get("source") or "bundled"
    resolved_label = infer_canonical_vehicle_type_label(
        raw_type,
        brand=str(vehicle.get("brand") or ""),
        model=str(vehicle.get("model") or ""),
        descriptor=str(vehicle.get("descriptor") or ""),
        body_class=str(vehicle.get("body_class") or vehicle.get("vpic_body_class") or ""),
    ) or asset.get("label") or slug
    base_url = asset["url"]
    return {
        "slug": slug,
        "vehicle_type": raw_type or resolved_label,
        "label": resolved_label,
        "url": f"{base_url}?v={version}",
        "watermark_url": f"{base_url}?style=watermark&v={version}",
    }


def apply_upload_metadata(settings_doc: dict[str, Any], slug: str) -> dict[str, Any]:
    settings_doc = dict(settings_doc or {})
    overrides = dict(settings_doc.get("overrides") or {})
    overrides[slug] = {
        "updated_at": _utc_now_iso(),
        "source": "active",
    }
    settings_doc["overrides"] = overrides
    settings_doc["updated_at"] = _utc_now_iso()
    return settings_doc


def apply_reset_metadata(settings_doc: dict[str, Any], slug: str) -> dict[str, Any]:
    settings_doc = dict(settings_doc or {})
    overrides = dict(settings_doc.get("overrides") or {})
    overrides.pop(slug, None)
    settings_doc["overrides"] = overrides
    settings_doc["updated_at"] = _utc_now_iso()
    return settings_doc