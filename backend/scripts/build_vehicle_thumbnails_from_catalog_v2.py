#!/usr/bin/env python3
"""Build ERP vehicle silhouettes from the labeled black-silhouette catalog sheet.

Source layout (sheet-silhouette-catalog-v2.png), left→right / top→bottom:
  MICRO | SEDAN | HATCHBACK | COUPE | STATION WAGON
  ROADSTER | CABRIOLET | MUSCLE CAR | SPORT CAR | SUPER CAR
  LIMOUSINE | CUV | PICKUP | SUV
  MINIVAN | VAN | CAMPERVAN | BUS
  MONSTER TRUCK | MINI TRUCK | TRUCK | BIG TRUCK
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT.parent) not in sys.path:
    sys.path.insert(0, str(ROOT.parent))

from backend.domains.vehicles.thumbnails import (  # noqa: E402
    BUNDLED_DIR,
    CANVAS_SIZE,
    DEFAULT_SLUG,
    MANIFEST_PATH,
    VEHICLE_THUMBNAIL_CATALOG,
    WATERMARK_DIR,
    _to_rgba,
    compose_thumbnail_canvas,
    compose_watermark_canvas,
)
from backend.domains.vehicles.type_resolver import TYPE_ALIASES  # noqa: E402

SOURCE_CANDIDATES = [
    Path("/tmp/sheet-silhouette-catalog-v2.png"),
    ROOT / "assets" / "vehicle-thumbnails" / "sources" / "sheet-silhouette-catalog-v2.png",
]
OUT_PUBLIC = ROOT.parent / "frontend" / "public" / "vehicles" / "thumbnails"
OUT_SRC_MANIFEST = ROOT.parent / "frontend" / "src" / "data" / "vehicleThumbnailManifest.json"

# Row-major labels matching the sheet
SHEET_LABELS: list[list[str]] = [
    ["MICRO", "SEDAN", "HATCHBACK", "COUPE", "STATION WAGON"],
    ["ROADSTER", "CABRIOLET", "MUSCLE CAR", "SPORT CAR", "SUPER CAR"],
    ["LIMOUSINE", "CUV", "PICKUP", "SUV"],
    ["MINIVAN", "VAN", "CAMPERVAN", "BUS"],
    ["MONSTER TRUCK", "MINI TRUCK", "TRUCK", "BIG TRUCK"],
]

# Map sheet labels → ERP slugs (primary + optional extras we may store)
LABEL_TO_SLUG: dict[str, str] = {
    "SEDAN": "sedan",
    "HATCHBACK": "hatchback",
    "STATION WAGON": "station-wagon",
    "CABRIOLET": "convertible",
    "ROADSTER": "convertible",  # fallback alias asset
    "SUV": "suv",
    "CUV": "suv",
    "PICKUP": "camioneta-1-cabina",
    "MINIVAN": "microbus-pasajeros",
    "VAN": "microbus-carga",
    "BUS": "microbus-pasajeros",
    "CAMPERVAN": "microbus-carga",
    "MINI TRUCK": "camion-carga",
    "TRUCK": "camion-carga",
    "BIG TRUCK": "cabezal",
    "MONSTER TRUCK": "camion-carga",
    "MICRO": "hatchback",
    "COUPE": "sedan",
    "MUSCLE CAR": "sedan",
    "SPORT CAR": "convertible",
    "SUPER CAR": "convertible",
    "LIMOUSINE": "sedan",
}

# Preferred label per ERP slug when multiple labels map to same slug
SLUG_PREFERRED_LABEL: dict[str, str] = {
    "sedan": "SEDAN",
    "hatchback": "HATCHBACK",
    "station-wagon": "STATION WAGON",
    "convertible": "CABRIOLET",
    "suv": "SUV",
    "camioneta-1-cabina": "PICKUP",
    "camioneta-cabina-y-media": "PICKUP",  # sheet has no crew-cab; use pickup silhouette
    "microbus-pasajeros": "MINIVAN",
    "microbus-carga": "VAN",
    "camion-carga": "TRUCK",
    "cabezal": "BIG TRUCK",
    "default": "SEDAN",
}


def _dark_mask(im: Image.Image, threshold: int = 90) -> Image.Image:
    gray = im.convert("L")
    # Silhouettes are near-black; labels too — we crop by ink blobs above text bands
    return gray.point(lambda p: 255 if p < threshold else 0, mode="1")


def _row_activity(mask: Image.Image) -> list[int]:
    w, h = mask.size
    px = mask.load()
    out = []
    for y in range(h):
        total = 0
        for x in range(w):
            if px[x, y] == 0:  # black in mode "1" is ink? PIL "1" : 0=black, 255=white
                total += 1
        out.append(total)
    return out


def _find_bands(activity: list[int], min_len: int = 18, thr_ratio: float = 0.04) -> list[tuple[int, int]]:
    peak = max(activity) if activity else 1
    thr = max(8, int(peak * thr_ratio))
    bands: list[tuple[int, int]] = []
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


def _col_activity(mask: Image.Image, y0: int, y1: int) -> list[int]:
    w, _ = mask.size
    px = mask.load()
    out = []
    for x in range(w):
        total = 0
        for y in range(y0, y1 + 1):
            if px[x, y] == 0:
                total += 1
        out.append(total)
    return out


def segment_sheet(im: Image.Image) -> list[list[Image.Image]]:
    """Return crops[row][col] of silhouettes (ink only region with small pad)."""
    rgba = _to_rgba(im)
    mask = _dark_mask(rgba)
    # Slight blur then re-threshold to connect silhouette
    mask = mask.convert("L").filter(ImageFilter.MaxFilter(3)).point(lambda p: 255 if p > 128 else 0, mode="1")

    row_act = _row_activity(mask)
    # Merge thin gaps (label bands under silhouettes create gaps within a visual row)
    # Strategy: find thick horizontal ink bands; each catalog row has silhouette band then label band.
    # We take the top portion of each pair as silhouette.
    raw_bands = _find_bands(row_act, min_len=12, thr_ratio=0.035)
    if len(raw_bands) < 5:
        # Fallback: split into 5 equal vertical slices
        h = im.height
        step = h // 5
        raw_bands = [(i * step, min(h - 1, (i + 1) * step - 1)) for i in range(5)]

    # Group into 5 catalog rows: silhouette band is the denser upper portion of each group
    # raw_bands may be silhouette+label alternating → take every silhouette-looking band
    # Prefer 5 widest/darkest bands spaced down the image
    if len(raw_bands) > 5:
        # Score by density * height
        scored = []
        for a, b in raw_bands:
            dens = sum(row_act[a : b + 1]) / max(1, b - a + 1)
            scored.append(((b - a) * dens, a, b))
        scored.sort(reverse=True)
        top5 = sorted(scored[:5], key=lambda t: t[1])
        sil_bands = [(a, b) for _, a, b in top5]
    else:
        sil_bands = raw_bands[:5]
        while len(sil_bands) < 5:
            sil_bands.append(sil_bands[-1] if sil_bands else (0, im.height - 1))

    rows_out: list[list[Image.Image]] = []
    expected_cols = [len(r) for r in SHEET_LABELS]

    for row_idx, (y0, y1) in enumerate(sil_bands):
        # Trim label: keep upper ~72% of band as silhouette body
        band_h = y1 - y0 + 1
        y_cut = y0 + max(20, int(band_h * 0.78))
        y1_use = min(y1, y_cut)

        col_act = _col_activity(mask, y0, y1_use)
        segs = _find_bands(col_act, min_len=20, thr_ratio=0.05)
        want = expected_cols[row_idx] if row_idx < len(expected_cols) else 4
        if len(segs) < want:
            # equal split fallback
            w = im.width
            step = w // want
            segs = [(i * step + 4, min(w - 1, (i + 1) * step - 4)) for i in range(want)]
        elif len(segs) > want:
            # keep largest `want` segments left-to-right
            segs = sorted(segs, key=lambda s: -(s[1] - s[0]))[:want]
            segs = sorted(segs, key=lambda s: s[0])

        crops: list[Image.Image] = []
        for x0, x1 in segs[:want]:
            pad = 4
            box = (
                max(0, x0 - pad),
                max(0, y0 - pad),
                min(im.width, x1 + pad + 1),
                min(im.height, y1_use + pad + 1),
            )
            crops.append(rgba.crop(box))
        rows_out.append(crops)

    return rows_out


def resolve_source() -> Path:
    for p in SOURCE_CANDIDATES:
        if p.exists():
            return p
    raise FileNotFoundError(
        "sheet-silhouette-catalog-v2.png not found. Place it under "
        "backend/assets/vehicle-thumbnails/sources/ or /tmp/"
    )


def build_all() -> dict:
    source = resolve_source()
    print(f"source: {source}")
    with Image.open(source) as src:
        im = _to_rgba(src)
        rows = segment_sheet(im)

    label_to_crop: dict[str, Image.Image] = {}
    for r_i, row in enumerate(rows):
        labels = SHEET_LABELS[r_i] if r_i < len(SHEET_LABELS) else []
        for c_i, crop in enumerate(row):
            if c_i >= len(labels):
                break
            label_to_crop[labels[c_i]] = crop
            print(f"  segmented {labels[c_i]} size={crop.size}")

    BUNDLED_DIR.mkdir(parents=True, exist_ok=True)
    WATERMARK_DIR.mkdir(parents=True, exist_ok=True)
    OUT_PUBLIC.mkdir(parents=True, exist_ok=True)

    # Build each ERP catalog slug from preferred sheet label
    assets: dict = {}
    for item in VEHICLE_THUMBNAIL_CATALOG:
        slug = item["slug"]
        label = SLUG_PREFERRED_LABEL.get(slug)
        if not label or label not in label_to_crop:
            print(f"WARN: no crop for slug={slug} label={label}")
            continue
        crop = label_to_crop[label]
        card = compose_thumbnail_canvas(crop)
        wm = compose_watermark_canvas(crop)
        filename = f"{slug}.png"
        card.save(BUNDLED_DIR / filename, format="PNG", optimize=True)
        wm.save(WATERMARK_DIR / filename, format="PNG", optimize=True)
        card.save(OUT_PUBLIC / filename, format="PNG", optimize=True)
        assets[slug] = {
            "file": filename,
            "source": "sheet-silhouette-catalog-v2",
            "sheet_label": label,
            "url": f"/api/vehicle-thumbnails/{slug}.png",
        }
        print(f"built {slug} from {label}")

    # default = sedan
    if "sedan" in assets:
        for folder in (BUNDLED_DIR, WATERMARK_DIR, OUT_PUBLIC):
            src = folder / "sedan.png"
            if src.exists():
                (folder / "default.png").write_bytes(src.read_bytes())
        assets["default"] = {
            "file": "default.png",
            "source": "sheet-silhouette-catalog-v2",
            "sheet_label": "SEDAN",
            "url": "/api/vehicle-thumbnails/default.png",
        }

    # dual-cab: reuse pickup until a dedicated crew-cab art exists
    if "camioneta-1-cabina" in assets and "camioneta-cabina-y-media" not in assets:
        for folder in (BUNDLED_DIR, WATERMARK_DIR, OUT_PUBLIC):
            src = folder / "camioneta-1-cabina.png"
            if src.exists():
                (folder / "camioneta-cabina-y-media.png").write_bytes(src.read_bytes())
        assets["camioneta-cabina-y-media"] = {
            "file": "camioneta-cabina-y-media.png",
            "source": "sheet-silhouette-catalog-v2",
            "sheet_label": "PICKUP",
            "note": "No crew-cab in catalog v2; reuses PICKUP silhouette",
            "url": "/api/vehicle-thumbnails/camioneta-cabina-y-media.png",
        }

    # Expand type aliases for new labels
    aliases = dict(TYPE_ALIASES)
    aliases.update(
        {
            "micro": "hatchback",
            "coupe": "sedan",
            "coupé": "sedan",
            "roadster": "convertible",
            "cabriolet": "convertible",
            "muscle car": "sedan",
            "sport car": "convertible",
            "super car": "convertible",
            "limousine": "sedan",
            "cuv": "suv",
            "pickup": "camioneta-1-cabina",
            "minivan": "microbus-pasajeros",
            "van": "microbus-carga",
            "campervan": "microbus-carga",
            "bus": "microbus-pasajeros",
            "mini truck": "camion-carga",
            "monster truck": "camion-carga",
            "truck": "camion-carga",
            "big truck": "cabezal",
        }
    )

    manifest = {
        "version": 4,
        "default_slug": DEFAULT_SLUG,
        "canvas": {"width": CANVAS_SIZE[0], "height": CANVAS_SIZE[1]},
        "catalog": VEHICLE_THUMBNAIL_CATALOG,
        "assets": assets,
        "type_aliases": aliases,
        "sources": {
            "sheet-silhouette-catalog-v2": {
                "file": "sheet-silhouette-catalog-v2.png",
                "description": "Black silhouette vehicle type catalog (micro, sedan, hatch, pickup, SUV, vans, trucks)",
                "labels": SHEET_LABELS,
                "slug_map": SLUG_PREFERRED_LABEL,
            }
        },
    }

    text = json.dumps(manifest, indent=2, ensure_ascii=False)
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.write_text(text, encoding="utf-8")
    OUT_PUBLIC.mkdir(parents=True, exist_ok=True)
    (OUT_PUBLIC / "manifest.json").write_text(text, encoding="utf-8")
    OUT_SRC_MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    OUT_SRC_MANIFEST.write_text(text, encoding="utf-8")
    print(f"manifest -> {MANIFEST_PATH}")
    print(f"public   -> {OUT_PUBLIC}")
    return manifest


if __name__ == "__main__":
    build_all()
