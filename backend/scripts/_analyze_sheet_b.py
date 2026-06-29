"""Deep analysis of sheet-b vehicle sprite layout."""
import sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parent))
from backend.domains.vehicles.thumbnails import _to_rgba

SOURCE = Path(__file__).resolve().parents[1] / "assets" / "vehicle-thumbnails" / "sources" / "sheet-truck-set.jpg"
OUT = Path(__file__).resolve().parents[1] / "data" / "vehicle-thumbnails" / "analysis"
OUT.mkdir(parents=True, exist_ok=True)


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


def find_segments(activity: list[float], min_gap: int = 6, threshold_ratio: float = 0.06):
    max_val = max(activity) if activity else 1.0
    threshold = max_val * threshold_ratio
    segments = []
    start = None
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
                if end - start >= 15:
                    segments.append((start, end))
                start = None
                gap = 0
    if start is not None:
        segments.append((start, len(activity) - 1))
    return segments


with Image.open(SOURCE) as src:
    im = _to_rgba(src)
    print("size", im.size)
    activity = column_activity(im)
    segments = find_segments(activity)
    print("auto_segments", len(segments))
    for i, (l, r) in enumerate(segments, 1):
        crop = im.crop((l, 0, r + 1, im.height))
        crop.save(OUT / f"auto_{i:02d}_{l}-{r}.png")
        print(f"  {i}: {l}-{r} width={r-l+1}")

    for cols in range(4, 12):
        cell_w = im.width // cols
        print(f"grid_{cols}_cols cell_w={cell_w}")
        for c in range(cols):
            left = c * cell_w
            right = im.width if c == cols - 1 else (c + 1) * cell_w
            crop = im.crop((left, 0, right, im.height))
            crop.save(OUT / f"grid{cols}_col{c+1}.png")

print("written to", OUT)