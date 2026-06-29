"""Measure actual dark silhouette occupancy inside bundled thumbnails."""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BUNDLED = ROOT / "assets" / "vehicle-thumbnails" / "bundled"


def dark_bounds(image: Image.Image, darkness_threshold: int = 200) -> tuple[int, int, int, int] | None:
    rgba = image.convert("RGBA")
    width, height = rgba.size
    pixels = rgba.load()
    bounds = None
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if a < 20:
                continue
            if (r + g + b) / 3 <= darkness_threshold:
                if bounds is None:
                    bounds = [x, y, x, y]
                else:
                    bounds[0] = min(bounds[0], x)
                    bounds[1] = min(bounds[1], y)
                    bounds[2] = max(bounds[2], x)
                    bounds[3] = max(bounds[3], y)
    return tuple(bounds) if bounds else None


def main() -> None:
    for path in sorted(BUNDLED.glob("*.png")):
        with Image.open(path) as image:
            w, h = image.size
            bounds = dark_bounds(image)
            if not bounds:
                print(f"{path.name}: no dark ink")
                continue
            left, top, right, bottom = bounds
            iw, ih = right - left + 1, bottom - top + 1
            print(
                f"{path.name:30} canvas={w}x{h} silhouette={iw}x{ih} "
                f"fill={iw / w * 100:5.1f}% x {ih / h * 100:5.1f}%"
            )


if __name__ == "__main__":
    main()