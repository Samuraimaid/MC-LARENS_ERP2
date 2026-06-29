from __future__ import annotations

from pathlib import Path

from PIL import Image

base = Path(__file__).resolve().parents[1] / "assets" / "branding"
src = Image.open(base / "label-logos-source.png")
width, height = src.size

left = src.crop((0, 0, width // 2, height))
right = src.crop((width // 2, 0, width, height))


def ink_ratio(img: Image.Image) -> float:
    gray = img.convert("L")
    dark = sum(1 for pixel in gray.getdata() if pixel < 200)
    return dark / (gray.size[0] * gray.size[1])


lines = [
    f"source={width}x{height}",
    f"left_half_ink={ink_ratio(left):.4f}",
    f"right_half_ink={ink_ratio(right):.4f}",
]
for name in ("mundo-logo-label.png", "topcar-logo-label.png"):
    img = Image.open(base / name)
    lines.append(f"{name} size={img.size} ink={ink_ratio(img):.4f}")

out = Path(__file__).resolve().parents[1] / "data" / "_logo_debug.txt"
out.write_text("\n".join(lines), encoding="utf-8")
print(out)