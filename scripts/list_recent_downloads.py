import os
from pathlib import Path
from datetime import datetime

dl = Path(r"C:\Users\Xinon\Downloads")
images = []
for ext in ("*.jpg", "*.png", "*.jpeg", "*.webp"):
    images.extend(dl.glob(ext))

images.sort(key=lambda p: p.stat().st_mtime, reverse=True)

print(f"Total image files in Downloads: {len(images)}")
print("\nTop 40 most recent image files:")
for img in images[:40]:
    mtime = datetime.fromtimestamp(img.stat().st_mtime).strftime("%Y-%m-%d %H:%M:%S")
    size_kb = img.stat().st_size / 1024
    print(f"{img.name:<25} | {size_kb:8.1f} KB | {mtime}")
