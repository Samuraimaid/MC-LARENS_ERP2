from __future__ import annotations

from pathlib import Path
from typing import Iterable, List, Tuple, cast
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PUBLIC_DIR = ROOT / "frontend" / "public"
SOURCE = PUBLIC_DIR / "logo.png"
OUTPUT_LOGO = PUBLIC_DIR / "logo-transparent.png"
ICON_32 = PUBLIC_DIR / "favicon-32.png"
ICON_192 = PUBLIC_DIR / "icon-192.png"
ICON_512 = PUBLIC_DIR / "icon-512.png"

THRESHOLD = 240


def remove_white_background(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = cast(Iterable[Tuple[int, int, int, int]], rgba.getdata())
    new_pixels: List[Tuple[int, int, int, int]] = []
    for r, g, b, a in pixels:
        if a == 0:
            new_pixels.append((r, g, b, a))
            continue
        if r >= THRESHOLD and g >= THRESHOLD and b >= THRESHOLD:
            new_pixels.append((r, g, b, 0))
        else:
            new_pixels.append((r, g, b, a))
    rgba.putdata(new_pixels)
    return rgba


def make_square_icon(image: Image.Image, size: int) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    width, height = image.size
    scale = min((size * 0.8) / width, (size * 0.8) / height)
    new_w = max(1, int(width * scale))
    new_h = max(1, int(height * scale))
    resampling = getattr(Image, "Resampling", None)
    if resampling is not None:
        resample_filter = resampling.LANCZOS
    else:
        resample_filter = Image.BICUBIC  # type: ignore[attr-defined]
    resized = image.resize((new_w, new_h), resample_filter)
    offset = ((size - new_w) // 2, (size - new_h) // 2)
    canvas.paste(resized, offset, resized)
    return canvas


def main() -> None:
    if not SOURCE.exists():
        raise SystemExit(f"Logo not found: {SOURCE}")

    base = Image.open(SOURCE)
    cleaned = remove_white_background(base)
    cleaned.save(OUTPUT_LOGO, format="PNG")

    make_square_icon(cleaned, 32).save(ICON_32, format="PNG")
    make_square_icon(cleaned, 192).save(ICON_192, format="PNG")
    make_square_icon(cleaned, 512).save(ICON_512, format="PNG")


if __name__ == "__main__":
    main()
