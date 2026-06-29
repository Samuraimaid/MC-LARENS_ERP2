import sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parent))
from backend.domains.vehicles.thumbnails import _to_rgba

SOURCE = ROOT / "assets" / "vehicle-thumbnails" / "sources" / "sheet-truck-set.jpg"
OUT = ROOT / "data" / "vehicle-thumbnails" / "analysis"

with Image.open(SOURCE) as src:
    im = _to_rgba(src)
    w, h = im.size
    pixels = im.load()
    row_activity = []
    for y in range(h):
        total = 0.0
        for x in range(w):
            r, g, b, a = pixels[x, y]
            darkness = (255.0 - (r + g + b) / 3.0) / 255.0
            total += darkness * (a / 255.0 if a > 0.1 else 0.15)
        row_activity.append(total)

    max_val = max(row_activity)
    threshold = max_val * 0.06
    segments = []
    start = None
    gap = 0
    for y, value in enumerate(row_activity):
        active = value >= threshold
        if active:
            if start is None:
                start = y
            gap = 0
        elif start is not None:
            gap += 1
            if gap >= 6:
                end = y - gap
                if end - start >= 20:
                    segments.append((start, end))
                start = None
                gap = 0
    if start is not None:
        segments.append((start, h - 1))

    print("rows", len(segments), segments)
    for ridx, (top, bottom) in enumerate(segments, 1):
        row = im.crop((0, top, w, bottom + 1))
        row.save(OUT / f"row_{ridx}_{top}-{bottom}.png")
        # columns in row
        col_activity = []
        for x in range(w):
            total = 0.0
            for y2 in range(top, bottom + 1):
                r, g, b, a = pixels[x, y2]
                darkness = (255.0 - (r + g + b) / 3.0) / 255.0
                total += darkness * (a / 255.0 if a > 0.1 else 0.15)
            col_activity.append(total)
        max_c = max(col_activity)
        col_segments = []
        start_c = None
        gap_c = 0
        for x, value in enumerate(col_activity):
            active = value >= max_c * 0.06
            if active:
                if start_c is None:
                    start_c = x
                gap_c = 0
            elif start_c is not None:
                gap_c += 1
                if gap_c >= 6:
                    end_c = x - gap_c
                    if end_c - start_c >= 15:
                        col_segments.append((start_c, end_c))
                    start_c = None
                    gap_c = 0
        if start_c is not None:
            col_segments.append((start_c, w - 1))
        print(f" row{ridx} cols={len(col_segments)}", col_segments)
        for cidx, (l, r) in enumerate(col_segments, 1):
            crop = row.crop((l, 0, r + 1, row.height))
            crop.save(OUT / f"row{ridx}_col{cidx}_{l}-{r}.png")