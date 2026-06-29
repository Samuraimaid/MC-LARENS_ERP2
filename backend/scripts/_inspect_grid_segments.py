from pathlib import Path
from PIL import Image

grid = Path(__file__).resolve().parents[2] / "temporary_cleanup_validation" / "vehicle_sprite_analysis" / "1000_F_2042059554_fx2tvmGMSoV5a7lTiQuSlCmEkpbs2EZb" / "grid"
for seg in sorted(grid.glob("row1_col*.png")):
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
                        bounds = [min(bounds[0], x), min(bounds[1], y), max(bounds[2], x), max(bounds[3], y)]
        if bounds:
            bw, bh = bounds[2] - bounds[0] + 1, bounds[3] - bounds[1] + 1
            print(seg.name, rgba.size, f"ink={bw}x{bh}", f"ratio={bw/bh:.2f}")
        else:
            print(seg.name, rgba.size, "empty")