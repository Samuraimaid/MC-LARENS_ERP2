"""Analyze vehicle sprite sheets and export candidate crops."""
from pathlib import Path
from PIL import Image

OUT = Path(__file__).resolve().parents[2] / "temporary_cleanup_validation" / "vehicle_sprite_analysis"
OUT.mkdir(parents=True, exist_ok=True)

SOURCES = [
    Path(r"c:\Users\dayav\Downloads\1000_F_2026511635_iEEu60xz8YNM4V0W1BqE5YPOYQmb2BEG.jpg"),
    Path(r"c:\Users\dayav\Downloads\1000_F_2042059554_fx2tvmGMSoV5a7lTiQuSlCmEkpbs2EZb.jpg"),
]


def to_rgba(im: Image.Image) -> Image.Image:
    if im.mode == "RGBA":
        return im
    return im.convert("RGBA")


def column_activity(im: Image.Image) -> list[float]:
    rgba = to_rgba(im)
    width, height = rgba.size
    pixels = rgba.load()
    activity = []
    for x in range(width):
        total = 0.0
        for y in range(height):
            r, g, b, a = pixels[x, y]
            alpha = a / 255.0
            darkness = (255.0 - (r + g + b) / 3.0) / 255.0
            total += darkness * (alpha if alpha > 0.1 else 0.15)
        activity.append(total)
    return activity


def find_segments(activity: list[float], min_gap: int = 8, threshold_ratio: float = 0.08):
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
                if end - start >= 20:
                    segments.append((start, end))
                start = None
                gap = 0
    if start is not None:
        segments.append((start, len(activity) - 1))
    return segments


def trim_vertical(im: Image.Image, pad: int = 6) -> Image.Image:
    rgba = to_rgba(im)
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
    if bounds is None:
        return im
    left = max(0, bounds[0] - pad)
    top = max(0, bounds[1] - pad)
    right = min(width, bounds[2] + pad)
    bottom = min(height, bounds[3] + pad)
    return im.crop((left, top, right, bottom))


def process_sheet(path: Path):
    with Image.open(path) as src:
        im = to_rgba(src)
        activity = column_activity(im)
        segments = find_segments(activity)
        sheet_dir = OUT / path.stem
        sheet_dir.mkdir(parents=True, exist_ok=True)
        im.save(sheet_dir / "full.png")
        print(f"{path.name}: {len(segments)} segments")
        for idx, (left, right) in enumerate(segments, start=1):
            crop = im.crop((left, 0, right + 1, im.height))
            crop = trim_vertical(crop)
            target = sheet_dir / f"segment_{idx:02d}.png"
            crop.save(target)
            print(f"  seg {idx}: x={left}-{right} size={crop.size}")


for source in SOURCES:
    process_sheet(source)

print(f"analysis written to {OUT}")