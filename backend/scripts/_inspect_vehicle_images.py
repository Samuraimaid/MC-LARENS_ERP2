from pathlib import Path
from PIL import Image

paths = [
    Path(r"c:\Users\dayav\Downloads\1000_F_2026511635_iEEu60xz8YNM4V0W1BqE5YPOYQmb2BEG.jpg"),
    Path(r"c:\Users\dayav\Downloads\1000_F_2042059554_fx2tvmGMSoV5a7lTiQuSlCmEkpbs2EZb.jpg"),
    Path(r"c:\Users\dayav\OneDrive\Pictures\Screenshots\Captura de pantalla 2026-06-22 081051.png"),
]

for path in paths:
    print(f"exists={path.exists()} name={path.name}")
    if not path.exists():
        continue
    with Image.open(path) as im:
        print(f"  size={im.size} mode={im.mode}")