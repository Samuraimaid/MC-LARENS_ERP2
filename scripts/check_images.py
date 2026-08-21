import os

files = [
    "media_1787009700529.jpg",
    "media_1787009700553.jpg",
    "media_1787009700612.jpg",
    "media_1787009700651.jpg",
    "media_1787009700670.jpg"
]
folder = r"C:\Users\Xinon\.gemini\antigravity-ide\brain\972af972-50af-44f8-852b-45ccfb6a178b\.user_uploaded"

for f in files:
    path = os.path.join(folder, f)
    print(f"{f}: {os.path.getsize(path)} bytes")
