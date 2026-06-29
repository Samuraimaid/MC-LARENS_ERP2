"""Measure how much of each bundled thumbnail canvas is occupied by ink."""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BUNDLED = ROOT / "assets" / "vehicle-thumbnails" / "bundled"


def ink_bounds(image: Image.Image) -> tuple[int, int, int, int] | None:
    rgba = image.convert("RGBA")
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
    return tuple(bounds) if bounds else None


def main() -> None:
    for path in sorted(BUNDLED.glob("*.png")):
        with Image.open(path) as image:
            w, h = image.size
            bounds = ink_bounds(image)
            if not bounds:
                print(f"{path.name}: no ink")
                continue
            left, top, right, bottom = bounds
            iw, ih = right - left + 1, bottom - top + 1
            print(
                f"{path.name:30} canvas={w}x{h} ink={iw}x{ih} "
                f"fill={iw / w * 100:5.1f}% x {ih / h * 100:5.1f}%"
            )


if __name__ == "__main__":
    main()