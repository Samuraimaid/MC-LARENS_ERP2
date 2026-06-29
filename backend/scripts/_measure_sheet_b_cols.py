import sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parent))
from backend.domains.vehicles.thumbnails import _trim_ink_bounds, _to_rgba

analysis = ROOT / "data" / "vehicle-thumbnails" / "analysis"
for path in sorted(analysis.glob("grid5_col*.png")):
    with Image.open(path) as im:
        trimmed = _trim_ink_bounds(im)
        rgba = _to_rgba(trimmed)
        w, h = rgba.size
        print(path.name, f"trimmed={w}x{h}", f"ratio={w/max(h,1):.2f}")