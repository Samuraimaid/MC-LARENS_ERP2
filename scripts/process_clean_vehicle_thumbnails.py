"""
Script con Flood-Fill para remover fondo blanco exterior sin afectar la pintura blanca del auto.
"""
import glob
import os
from PIL import Image, ImageFilter

brain_dir = r"C:\Users\Xinon\.gemini\antigravity-ide\brain\972af972-50af-44f8-852b-45ccfb6a178b"
frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "vehicles"))
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend", "assets", "vehicle-thumbnails", "bundled"))

def flood_fill_transparent(img, threshold=240):
    img = img.convert("RGBA")
    w, h = img.size
    
    # Create mask for background: flood fill from the 4 corners
    # Start BFS from all edge pixels that are bright/white
    visited = set()
    queue = []
    
    pixels = img.load()
    
    for x in range(w):
        for y in (0, h - 1):
            r, g, b, a = pixels[x, y]
            if r >= threshold and g >= threshold and b >= threshold:
                queue.append((x, y))
                visited.add((x, y))
                
    for y in range(h):
        for x in (0, w - 1):
            if (x, y) not in visited:
                r, g, b, a = pixels[x, y]
                if r >= threshold and g >= threshold and b >= threshold:
                    queue.append((x, y))
                    visited.add((x, y))

    while queue:
        cx, cy = queue.pop(0)
        for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            nx, ny = cx + dx, cy + dy
            if 0 <= nx < w and 0 <= ny < h and (nx, ny) not in visited:
                r, g, b, a = pixels[nx, ny]
                if r >= threshold and g >= threshold and b >= threshold:
                    visited.add((nx, ny))
                    queue.append((nx, ny))

    # Apply transparency to visited background pixels
    for x, y in visited:
        r, g, b, _ = pixels[x, y]
        pixels[x, y] = (255, 255, 255, 0)
        
    return img

def crop_and_fit(img, target_w=640, target_h=360, padding=16):
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
    
    max_w = target_w - (padding * 2)
    max_h = target_h - (padding * 2)
    
    scale = min(max_w / img.width, max_h / img.height)
    new_w = int(img.width * scale)
    new_h = int(img.height * scale)
    
    resized = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
    
    canvas = Image.new("RGBA", (target_w, target_h), (0, 0, 0, 0))
    pos_x = (target_w - new_w) // 2
    pos_y = (target_h - new_h) // 2
    canvas.paste(resized, (pos_x, pos_y), resized)
    return canvas

mappings = [
    {
        "pattern": "sedan_lateral_clean_*.jpg",
        "targets": [
            os.path.join(frontend_dir, "thumbnails", "sedan.png"),
            os.path.join(backend_dir, "sedan.png"),
        ],
        "size": (640, 360),
    },
    {
        "pattern": "sedan_top_clean_*.jpg",
        "targets": [
            os.path.join(frontend_dir, "clean_sedan.png"),
        ],
        "size": (200, 360),
    },
    {
        "pattern": "station_wagon_lateral_*.jpg",
        "targets": [
            os.path.join(frontend_dir, "thumbnails", "station-wagon.png"),
            os.path.join(backend_dir, "station-wagon.png"),
        ],
        "size": (640, 360),
    },
    {
        "pattern": "pickup_single_cab_lateral_*.jpg",
        "targets": [
            os.path.join(frontend_dir, "thumbnails", "camioneta-1-cabina.png"),
            os.path.join(backend_dir, "camioneta-1-cabina.png"),
        ],
        "size": (640, 360),
    },
    {
        "pattern": "passenger_van_lateral_*.jpg",
        "targets": [
            os.path.join(frontend_dir, "thumbnails", "microbus-pasajeros.png"),
            os.path.join(backend_dir, "microbus-pasajeros.png"),
        ],
        "size": (640, 360),
    },
    {
        "pattern": "cargo_truck_lateral_*.jpg",
        "targets": [
            os.path.join(frontend_dir, "thumbnails", "camion-carga.png"),
            os.path.join(backend_dir, "camion-carga.png"),
        ],
        "size": (640, 360),
    },
]

for m in mappings:
    matches = glob.glob(os.path.join(brain_dir, m["pattern"]))
    if not matches:
        continue
    
    src_file = max(matches, key=os.path.getmtime)
    print(f"Flood-fill processing {os.path.basename(src_file)}...")
    raw_img = Image.open(src_file)
    trans_img = flood_fill_transparent(raw_img, threshold=240)
    final_img = crop_and_fit(trans_img, target_w=m["size"][0], target_h=m["size"][1])
    
    for target in m["targets"]:
        os.makedirs(os.path.dirname(target), exist_ok=True)
        final_img.save(target, "PNG", optimize=True)
        print(f"  [SAVED] {target}")

print("\nFlood-fill background removal complete!")
