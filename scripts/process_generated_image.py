import os
import sys
from PIL import Image

def flood_fill_transparent(img, threshold=240):
    """Convierte el fondo blanco externo en transparente protegiendo la carrocería."""
    img = img.convert("RGBA")
    w, h = img.size
    visited = set()
    queue = []
    pixels = img.load()

    # Borde superior e inferior
    for x in range(w):
        for y in (0, h - 1):
            r, g, b, _ = pixels[x, y]
            if r >= threshold and g >= threshold and b >= threshold:
                queue.append((x, y))
                visited.add((x, y))

    # Borde izquierdo y derecho
    for y in range(h):
        for x in (0, w - 1):
            if (x, y) not in visited:
                r, g, b, _ = pixels[x, y]
                if r >= threshold and g >= threshold and b >= threshold:
                    queue.append((x, y))
                    visited.add((x, y))

    # Inundación BFS
    while queue:
        cx, cy = queue.pop(0)
        for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            nx, ny = cx + dx, cy + dy
            if 0 <= nx < w and 0 <= ny < h and (nx, ny) not in visited:
                r, g, b, _ = pixels[nx, ny]
                if r >= threshold and g >= threshold and b >= threshold:
                    visited.add((nx, ny))
                    queue.append((nx, ny))

    for x, y in visited:
        pixels[x, y] = (255, 255, 255, 0)

    return img

def crop_and_fit(img, target_w=640, target_h=480, padding=14):
    """Centra la silueta conservando la relación de aspecto en 640x480 con fondo transparente."""
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

def process_file(src_path, dest_path):
    print(f"Processing {src_path} -> {dest_path}")
    img = Image.open(src_path)
    trans_img = flood_fill_transparent(img)
    final_img = crop_and_fit(trans_img, 640, 480)
    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    final_img.save(dest_path, "PNG", optimize=True)
    print(f"Saved: {dest_path} ({final_img.size})")

if __name__ == "__main__":
    if len(sys.argv) >= 3:
        process_file(sys.argv[1], sys.argv[2])
