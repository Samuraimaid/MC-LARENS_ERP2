from pathlib import Path
from PIL import Image

path = Path(r"c:\Users\dayav\Downloads\1000_F_2042059554_fx2tvmGMSoV5a7lTiQuSlCmEkpbs2EZb.jpg")
out = Path(__file__).resolve().parents[2] / "temporary_cleanup_validation" / "vehicle_sprite_analysis" / path.stem / "grid"
out.mkdir(parents=True, exist_ok=True)

with Image.open(path) as src:
    im = src.convert("RGBA")
    w, h = im.size
    # try 2 rows x 4 cols and 1 row x 5 cols
    for cols in (4, 5):
        cell_w = w // cols
        for i in range(cols):
            crop = im.crop((i * cell_w, 0, (i + 1) * cell_w if i < cols - 1 else w, h))
            crop.save(out / f"row1_col{i+1}_of_{cols}.png")
    for rows, cols in ((2, 2), (2, 3), (2, 4)):
        cell_w, cell_h = w // cols, h // rows
        for r in range(rows):
            for c in range(cols):
                left, top = c * cell_w, r * cell_h
                right = (c + 1) * cell_w if c < cols - 1 else w
                bottom = (r + 1) * cell_h if r < rows - 1 else h
                crop = im.crop((left, top, right, bottom))
                crop.save(out / f"r{rows}c{cols}_r{r+1}c{c+1}.png")
print(out)