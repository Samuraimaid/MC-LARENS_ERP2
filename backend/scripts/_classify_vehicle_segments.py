from pathlib import Path
from PIL import Image

base = Path(__file__).resolve().parents[2] / "temporary_cleanup_validation" / "vehicle_sprite_analysis"
for sheet in sorted(base.iterdir()):
    if not sheet.is_dir():
        continue
    print(f"=== {sheet.name} ===")
    for seg in sorted(sheet.glob("segment_*.png")):
        with Image.open(seg) as im:
            rgba = im.convert("RGBA")
            px = rgba.load()
            w, h = rgba.size
            bounds = None
            for y in range(h):
                for x in range(w):
                    r, g, b, a = px[x, y]
                    if a > 20 and (r + g + b) / 3 < 245:
                        if bounds is None:
                            bounds = [x, y, x, y]
                        else:
                            bounds = [
                                min(bounds[0], x),
                                min(bounds[1], y),
                                max(bounds[2], x),
                                max(bounds[3], y),
                            ]
            if bounds:
                bw = bounds[2] - bounds[0] + 1
                bh = bounds[3] - bounds[1] + 1
                ratio = round(bw / bh, 2)
                print(f"  {seg.name}: canvas={rgba.size} ink={bw}x{bh} ratio={ratio}")
            else:
                print(f"  {seg.name}: canvas={rgba.size} ink=none")