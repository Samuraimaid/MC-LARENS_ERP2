"""Build bundled vehicle silhouette PNGs from source sprite sheets."""
from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT.parent) not in sys.path:
    sys.path.insert(0, str(ROOT.parent))

from backend.domains.vehicles.sheet_b_grid import TYPE_GRID_CELLS, crop_sheet_b_cell
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

SOURCE_DIR = ROOT / "assets" / "vehicle-thumbnails" / "sources"
OUT_PUBLIC = ROOT.parent / "frontend" / "public" / "vehicles" / "thumbnails"
OUT_SRC_MANIFEST = ROOT.parent / "frontend" / "src" / "data" / "vehicleThumbnailManifest.json"

SHEET_A = SOURCE_DIR / "sheet-sedan-suv-set.jpg"
SHEET_B = SOURCE_DIR / "sheet-truck-set.jpg"
SHEET_A_SEGMENTS = 4


def column_activity(image: Image.Image) -> list[float]:
    rgba = _to_rgba(image)
    width, height = rgba.size
    pixels = rgba.load()
    activity: list[float] = []
    for x in range(width):
        total = 0.0
        for y in range(height):
            r, g, b, a = pixels[x, y]
            alpha = a / 255.0
            darkness = (255.0 - (r + g + b) / 3.0) / 255.0
            total += darkness * (alpha if alpha > 0.1 else 0.15)
        activity.append(total)
    return activity


def find_segments(activity: list[float], min_gap: int = 8, threshold_ratio: float = 0.08) -> list[tuple[int, int]]:
    max_val = max(activity) if activity else 1.0
    threshold = max_val * threshold_ratio
    segments: list[tuple[int, int]] = []
    start: int | None = None
    gap = 0
    for x, value in enumerate(activity):
        is_active = value >= threshold
        if is_active:
            if start is None:
                start = x
            gap = 0
        elif start is not None:
            gap += 1
            if gap >= min_gap:
                end = x - gap
                if end - start >= 20:
                    segments.append((start, end))
                start = None
                gap = 0
    if start is not None:
        segments.append((start, len(activity) - 1))
    return segments


def crop_sheet_a(index: int) -> Image.Image:
    with Image.open(SHEET_A) as src:
        im = _to_rgba(src)
        segments = find_segments(column_activity(im))
        if len(segments) < SHEET_A_SEGMENTS:
            raise RuntimeError(f"Expected {SHEET_A_SEGMENTS} segments in sheet A, found {len(segments)}")
        left, right = segments[index]
        return im.crop((left, 0, right + 1, im.height))


def crop_sheet_b_grid(row: int, col: int) -> Image.Image:
    with Image.open(SHEET_B) as src:
        return crop_sheet_b_cell(src, row, col)


def build_all() -> dict:
    BUNDLED_DIR.mkdir(parents=True, exist_ok=True)
    WATERMARK_DIR.mkdir(parents=True, exist_ok=True)
    OUT_PUBLIC.mkdir(parents=True, exist_ok=True)

    manifest = {
        "version": 3,
        "default_slug": DEFAULT_SLUG,
        "canvas": {"width": CANVAS_SIZE[0], "height": CANVAS_SIZE[1]},
        "catalog": VEHICLE_THUMBNAIL_CATALOG,
        "assets": {},
        "type_aliases": TYPE_ALIASES,
        "sources": {
            "sheet-b-grid": {
                "file": "sheet-truck-set.jpg",
                "description": "Pack multi-fila (Adobe 2042059554): hatchback, sedan, coupe, SUV, vans y camiones",
                "cells": TYPE_GRID_CELLS,
            },
            "sheet-a": {
                "file": "sheet-sedan-suv-set.jpg",
                "description": "Respaldo legacy (4 siluetas)",
            },
        },
    }

    for slug, (row, col) in TYPE_GRID_CELLS.items():
        crop = crop_sheet_b_grid(row, col)
        output = compose_thumbnail_canvas(crop)
        watermark = compose_watermark_canvas(crop)
        filename = f"{slug}.png"
        output.save(BUNDLED_DIR / filename, format="PNG", optimize=True)
        watermark.save(WATERMARK_DIR / filename, format="PNG", optimize=True)
        output.save(OUT_PUBLIC / filename, format="PNG", optimize=True)
        manifest["assets"][slug] = {
            "file": filename,
            "source": "sheet-b-grid",
            "row": row,
            "col": col,
            "url": f"/api/vehicle-thumbnails/{slug}.png",
        }
        print(f"built {filename} from sheet-b row={row} col={col}")

    manifest_json = json.dumps(manifest, indent=2, ensure_ascii=False)
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.write_text(manifest_json, encoding="utf-8")
    (OUT_PUBLIC / "manifest.json").write_text(manifest_json, encoding="utf-8")
    OUT_SRC_MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    OUT_SRC_MANIFEST.write_text(manifest_json, encoding="utf-8")
    print(f"manifest -> {MANIFEST_PATH}")
    return manifest


if __name__ == "__main__":
    build_all()