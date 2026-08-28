import os
from PIL import Image
from pathlib import Path

def main():
    dl = Path(r"C:\Users\Xinon\Downloads")
    files = ["GsCxn.jpg", "hW6Mv.jpg", "xMHsq.jpg", "JVSiC.jpg", "Unlb0.jpg", "PUGfF.jpg"]
    
    out_dir = Path("scripts/incoming_grok/inspect_lote1")
    out_dir.mkdir(parents=True, exist_ok=True)

    for name in files:
        p = dl / name
        im = Image.open(p)
        # Crop top 15% and bottom 15% to see labels
        w, h = im.size
        top_crop = im.crop((0, 0, w, int(h * 0.15)))
        bottom_crop = im.crop((0, int(h * 0.85), w, h))
        
        top_crop.save(out_dir / f"{name}_top_strip.jpg")
        bottom_crop.save(out_dir / f"{name}_bottom_strip.jpg")
        print(f"Saved crops for {name} ({im.size})")

if __name__ == "__main__":
    main()
