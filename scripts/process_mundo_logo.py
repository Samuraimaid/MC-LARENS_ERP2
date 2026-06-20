from __future__ import annotations

from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PUBLIC_DIR = ROOT / "frontend" / "public"

SOURCE_CANDIDATES = [
    PUBLIC_DIR / "logo-big.png",
    PUBLIC_DIR / "logo-big.jpg",
    PUBLIC_DIR / "logo-transparent.png",
]

OUT_LOGO = PUBLIC_DIR / "mundo-logo.png"
OUT_FAVICON = PUBLIC_DIR / "mundo-favicon-32.png"


def resolve_source() -> Path:
    for candidate in SOURCE_CANDIDATES:
        if candidate.exists():
            return candidate
    names = "\n".join(str(p) for p in SOURCE_CANDIDATES)
    raise FileNotFoundError(f"No se encontró fuente Mundo. Candidatos:\n{names}")


def crop_non_transparent(img: Image.Image) -> Image.Image:
    rgba = img.convert("RGBA")
    bbox = rgba.getbbox()
    if not bbox:
        return rgba
    return rgba.crop(bbox)


def crop_logo_content(img: Image.Image) -> Image.Image:
    rgba = img.convert("RGBA")
    width, height = rgba.size

    min_x, min_y = width, height
    max_x, max_y = -1, -1

    for y in range(height):
        for x in range(width):
            px = rgba.getpixel((x, y))
            if not isinstance(px, tuple) or len(px) < 4:
                continue
            r, g, b, a = int(px[0]), int(px[1]), int(px[2]), int(px[3])
            if a < 8:
                continue
            max_c = max(r, g, b)
            min_c = min(r, g, b)
            chroma = max_c - min_c
            is_logo_pixel = chroma >= 14 or max_c <= 140
            if not is_logo_pixel:
                continue

            min_x = min(min_x, x)
            min_y = min(min_y, y)
            max_x = max(max_x, x)
            max_y = max(max_y, y)

    if max_x < 0 or max_y < 0:
        return crop_non_transparent(rgba)

    pad_x = max(4, int((max_x - min_x + 1) * 0.02))
    pad_y = max(4, int((max_y - min_y + 1) * 0.035))
    left = max(0, min_x - pad_x)
    top = max(0, min_y - pad_y)
    right = min(width, max_x + pad_x + 1)
    bottom = min(height, max_y + pad_y + 1)
    return rgba.crop((left, top, right, bottom))


def create_favicon(img: Image.Image) -> Image.Image:
    cropped = crop_non_transparent(img)
    square = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
    cropped.thumbnail((220, 220), Image.Resampling.LANCZOS)
    x = (256 - cropped.width) // 2
    y = (256 - cropped.height) // 2
    square.alpha_composite(cropped, (x, y))
    return square.resize((32, 32), Image.Resampling.LANCZOS)


def main() -> None:
    source = resolve_source()
    src = Image.open(source)

    trimmed = crop_non_transparent(src)
    focused = crop_logo_content(trimmed)

    logo = focused.copy()
    logo.thumbnail((1280, 720), Image.Resampling.LANCZOS)
    logo.save(OUT_LOGO, format="PNG")

    favicon = create_favicon(logo)
    favicon.save(OUT_FAVICON, format="PNG")

    print(f"OK source -> {source}")
    print(f"OK logo -> {OUT_LOGO}")
    print(f"OK favicon -> {OUT_FAVICON}")


if __name__ == "__main__":
    main()
