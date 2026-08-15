#!/usr/bin/env python3
"""Extract pickup cab silhouettes from body-types sheet for ERP camioneta slugs.

Sheet rows (top→bottom):
  1 Double Cab
  2 Monocoque Double Cab
  3 Extended Cab
  4 Regular Cab
  5 Monocoque Extended Cab
  6 Monocoque Regular Cab
  7 Chassis Double Cab
  8 Chassis Regular Cab

ERP mapping:
  camioneta-1-cabina       ← Regular Cab (#4)
  camioneta-cabina-y-media ← Double Cab (#1)
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT.parent) not in sys.path:
    sys.path.insert(0, str(ROOT.parent))

from backend.domains.vehicles.thumbnails import (  # noqa: E402
    BUNDLED_DIR,
    MANIFEST_PATH,
    WATERMARK_DIR,
    _to_rgba,
    compose_thumbnail_canvas,
    compose_watermark_canvas,
)

SOURCE_CANDIDATES = [
    Path("/tmp/sheet-pickup-cab-types.png"),
    ROOT / "assets" / "vehicle-thumbnails" / "sources" / "sheet-pickup-cab-types.png",
]
OUT_PUBLIC = ROOT.parent / "frontend" / "public" / "vehicles" / "thumbnails"
OUT_SRC_MANIFEST = ROOT.parent / "frontend" / "src" / "data" / "vehicleThumbnailManifest.json"

# Prefer classic double-cab and regular-cab (not chassis flatbed / monocoque variants)
ROW_LABELS = [
    "double_cab",
    "monocoque_double_cab",
    "extended_cab",
    "regular_cab",
    "monocoque_extended_cab",
    "monocoque_regular_cab",
    "chassis_double_cab",
    "chassis_regular_cab",
]

SLUG_FROM_ROW = {
    "camioneta-cabina-y-media": "double_cab",
    "camioneta-1-cabina": "regular_cab",
}


def _bg_color(im: Image.Image, margin: int = 6) -> tuple[int, int, int]:
    rgba = _to_rgba(im)
    w, h = rgba.size
    px = rgba.load()
    samples = []
    coords = [
        (margin, margin),
        (w - margin - 1, margin),
        (margin, h - margin - 1),
        (w - margin - 1, h - margin - 1),
        (w // 2, margin),
    ]
    for x, y in coords:
        r, g, b, a = px[max(0, min(w - 1, x)), max(0, min(h - 1, y))]
        samples.append((r, g, b))
    return tuple(int(sum(c[i] for c in samples) / len(samples)) for i in range(3))  # type: ignore


def photo_to_black_silhouette(im: Image.Image, thr: int = 26) -> Image.Image:
    """Convert light-bg product photo to opaque dark silhouette (matches ERP style)."""
    rgba = _to_rgba(im)
    w, h = rgba.size
    bg = _bg_color(rgba)
    px = rgba.load()
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    op = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 15:
                continue
            dist = abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2])
            # Also treat pure-ish white body panels as vehicle if neighbors are dark wheels
            if dist >= thr or (r + g + b) / 3 < 250 and dist >= thr * 0.55:
                # Soften: require either darkness OR clear difference from bg
                if dist >= thr or min(r, g, b) < 220:
                    op[x, y] = (28, 30, 34, 255)
    return out


def _ink_mask(im: Image.Image, thr: int = 18) -> Image.Image:
    """Mask of non-background pixels for row segmentation."""
    rgba = _to_rgba(im)
    w, h = rgba.size
    bg = _bg_color(rgba)
    px = rgba.load()
    mask = Image.new("1", (w, h), 1)
    mp = mask.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 20:
                continue
            dist = abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2])
            if dist >= thr:
                mp[x, y] = 0
    return mask


def _row_activity(mask: Image.Image) -> list[int]:
    w, h = mask.size
    px = mask.load()
    out = []
    for y in range(h):
        t = 0
        for x in range(w):
            if px[x, y] == 0:
                t += 1
        out.append(t)
    return out


def _bands(activity: list[int], min_len: int = 30, thr_ratio: float = 0.08) -> list[tuple[int, int]]:
    peak = max(activity) if activity else 1
    thr = max(20, int(peak * thr_ratio))
    bands = []
    start = None
    for i, v in enumerate(activity):
        if v >= thr:
            if start is None:
                start = i
        elif start is not None:
            if i - start >= min_len:
                bands.append((start, i - 1))
            start = None
    if start is not None and len(activity) - start >= min_len:
        bands.append((start, len(activity) - 1))
    return bands


def segment_vehicle_rows(im: Image.Image) -> dict[str, Image.Image]:
    """Crop left vehicle region for each of 8 rows."""
    rgba = _to_rgba(im)
    # Skip red title banner (~top 8%)
    top_skip = int(im.height * 0.09)
    work = rgba.crop((0, top_skip, im.width, im.height))
    mask = _ink_mask(work)
    act = _row_activity(mask)
    bands = _bands(act, min_len=25, thr_ratio=0.06)

    # Expect ~8 vehicle rows; if more, keep 8 tallest spaced ones
    if len(bands) > 8:
        scored = sorted(((b - a, a, b) for a, b in bands), reverse=True)[:8]
        bands = sorted([(a, b) for _, a, b in scored], key=lambda t: t[0])
    elif len(bands) < 8:
        # equal split fallback
        h = work.height
        step = h // 8
        bands = [(i * step + 4, min(h - 1, (i + 1) * step - 8)) for i in range(8)]

    bands = bands[:8]
    out: dict[str, Image.Image] = {}
    for i, (y0, y1) in enumerate(bands):
        # Vehicle is on the left ~58% of width (labels on right)
        x1 = int(work.width * 0.58)
        crop = work.crop((8, max(0, y0 - 2), x1, min(work.height, y1 + 2)))
        label = ROW_LABELS[i] if i < len(ROW_LABELS) else f"row_{i}"
        out[label] = crop
        print(f"  row {i+1} {label}: {crop.size}")
    return out


def resolve_source() -> Path:
    for p in SOURCE_CANDIDATES:
        if p.exists():
            return p
    raise FileNotFoundError("sheet-pickup-cab-types.png not found")


def build() -> None:
    source = resolve_source()
    print(f"source: {source}")
    with Image.open(source) as src:
        crops = segment_vehicle_rows(src)

    BUNDLED_DIR.mkdir(parents=True, exist_ok=True)
    WATERMARK_DIR.mkdir(parents=True, exist_ok=True)
    OUT_PUBLIC.mkdir(parents=True, exist_ok=True)

    for slug, row_key in SLUG_FROM_ROW.items():
        crop = crops.get(row_key)
        if crop is None:
            print(f"WARN missing {row_key} for {slug}")
            continue
        # Photos → black silhouettes so watermark style matches sedan/suv pack
        sil = photo_to_black_silhouette(crop)
        card = compose_thumbnail_canvas(sil)
        wm = compose_watermark_canvas(sil)
        name = f"{slug}.png"
        card.save(BUNDLED_DIR / name, format="PNG", optimize=True)
        wm.save(WATERMARK_DIR / name, format="PNG", optimize=True)
        card.save(OUT_PUBLIC / name, format="PNG", optimize=True)
        print(f"built {slug} from {row_key}")

    # Update manifest assets metadata if present
    if MANIFEST_PATH.exists():
        try:
            manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
        except Exception:
            manifest = {}
        assets = manifest.setdefault("assets", {})
        for slug, row_key in SLUG_FROM_ROW.items():
            assets[slug] = {
                "file": f"{slug}.png",
                "source": "sheet-pickup-cab-types",
                "sheet_label": row_key,
                "url": f"/api/vehicle-thumbnails/{slug}.png",
            }
        sources = manifest.setdefault("sources", {})
        sources["sheet-pickup-cab-types"] = {
            "file": "sheet-pickup-cab-types.png",
            "description": "Pickup body types: double/extended/regular cab + chassis",
            "slug_map": SLUG_FROM_ROW,
        }
        text = json.dumps(manifest, indent=2, ensure_ascii=False)
        MANIFEST_PATH.write_text(text, encoding="utf-8")
        OUT_PUBLIC.mkdir(parents=True, exist_ok=True)
        (OUT_PUBLIC / "manifest.json").write_text(text, encoding="utf-8")
        OUT_SRC_MANIFEST.parent.mkdir(parents=True, exist_ok=True)
        OUT_SRC_MANIFEST.write_text(text, encoding="utf-8")
        print(f"manifest updated {MANIFEST_PATH}")


if __name__ == "__main__":
    build()
