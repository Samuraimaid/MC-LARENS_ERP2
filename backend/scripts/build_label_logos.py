from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageOps

def _resolve_branding_dir() -> Path:
    candidates = [
        Path(__file__).resolve().parents[1] / "assets" / "branding",
        Path("/app/backend/assets/branding"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return candidates[0]


BRANDING = _resolve_branding_dir()
SOURCE = BRANDING / "label-logos-source.png"

OUTPUTS = {
    "left": BRANDING / "mundo-logo-label.png",
    "right": BRANDING / "topcar-logo-label.png",
}

def _trim_logo_canvas(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    width, height = rgba.size
    min_x, min_y = width, height
    max_x, max_y = -1, -1

    for y in range(height):
        for x in range(width):
            r, g, b, a = rgba.getpixel((x, y))
            if a < 12:
                continue
            luminance = int(0.299 * r + 0.587 * g + 0.114 * b)
            if luminance > 228:
                continue
            min_x = min(min_x, x)
            min_y = min(min_y, y)
            max_x = max(max_x, x)
            max_y = max(max_y, y)

    if max_x < 0 or max_y < 0:
        bbox = rgba.getbbox()
        return rgba.crop(bbox) if bbox else rgba

    pad = max(4, int(min(width, height) * 0.02))
    left = max(0, min_x - pad)
    top = max(0, min_y - pad)
    right = min(width, max_x + pad + 1)
    bottom = min(height, max_y + pad + 1)
    return rgba.crop((left, top, right, bottom))


def _to_label_mono(image: Image.Image) -> Image.Image:
    rgba = _trim_logo_canvas(image)
    gray = ImageOps.grayscale(rgba)
    gray = ImageOps.autocontrast(gray, cutoff=1)
    mono = gray.point(lambda value: 0 if value < 210 else 255, mode="1")
    return mono.convert("RGBA")


def main() -> None:
    if not SOURCE.exists():
        raise FileNotFoundError(f"Missing source image: {SOURCE}")

    source = Image.open(SOURCE).convert("RGBA")
    width, height = source.size
    # Mitad izquierda = TopCar, mitad derecha = Mundo de Accesorios.
    brand_halves = {
        "topcar": source.crop((0, 0, width // 2, height)),
        "mundo": source.crop((width // 2, 0, width, height)),
    }

    output_keys = {
        "mundo": "left",
        "topcar": "right",
    }
    for brand, output_key in output_keys.items():
        mono = _to_label_mono(brand_halves[brand])
        output = OUTPUTS[output_key]
        mono.save(output, format="PNG")
        print(f"Wrote {output} ({mono.size[0]}x{mono.size[1]})")


if __name__ == "__main__":
    main()