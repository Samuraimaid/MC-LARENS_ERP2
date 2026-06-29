from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageChops

base = Path(__file__).resolve().parents[1] / "assets" / "branding"
src = Image.open(base / "label-logos-source.png")
width, height = src.size
left = src.crop((0, 0, width // 2, height)).convert("L")
right = src.crop((width // 2, 0, width, height)).convert("L")


def diff_score(a: Image.Image, b: Image.Image) -> float:
    b = b.resize(a.size, Image.LANCZOS)
    diff = ImageChops.difference(a, b)
    hist = diff.histogram()
    total = sum(hist)
    mean = sum(i * c for i, c in enumerate(hist)) / max(total, 1)
    return mean


lines = []
for brand, ref_name in (("mundo", "mundo-logo.png"), ("topcar", "topcar-logo.png")):
    ref = Image.open(base / ref_name).convert("L")
    left_score = diff_score(left, ref)
    right_score = diff_score(right, ref)
    lines.append(f"{brand}_ref vs left_half diff={left_score:.2f}")
    lines.append(f"{brand}_ref vs right_half diff={right_score:.2f}")
    lines.append(f"  -> {brand} likely on {'LEFT' if left_score < right_score else 'RIGHT'}")
    lines.append("")

for label_name in ("mundo-logo-label.png", "topcar-logo-label.png"):
    label = Image.open(base / label_name).convert("L")
    for half_name, half in (("left", left), ("right", right)):
        lines.append(f"{label_name} vs {half_name}_half diff={diff_score(half, label):.2f}")
    lines.append("")

out = Path(__file__).resolve().parents[1] / "data" / "_logo_match.txt"
out.write_text("\n".join(lines), encoding="utf-8")
print(out)