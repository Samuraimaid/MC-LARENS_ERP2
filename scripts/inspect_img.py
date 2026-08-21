import os
import shutil

# Check if PIL is available in blender python
try:
    from PIL import Image
    print("PIL is available!")
except ImportError:
    print("PIL is not available")

folder = r"C:\Users\Xinon\.gemini\antigravity-ide\brain\972af972-50af-44f8-852b-45ccfb6a178b\.user_uploaded"
files = [
    "media_1787009700529.jpg",
    "media_1787009700553.jpg",
    "media_1787009700612.jpg",
    "media_1787009700651.jpg",
    "media_1787009700670.jpg"
]

for f in files:
    img_path = os.path.join(folder, f)
    img = Image.open(img_path)
    print(f"{f}: size = {img.size}, mode = {img.mode}")
