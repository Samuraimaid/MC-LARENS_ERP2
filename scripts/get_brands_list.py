import re
from pathlib import Path

def extract_brands():
    brands = set()
    
    # 1. Inspect vehicle_catalog_export.html
    html_path = Path("c:/ANTIGRAVITY/MC-LARENS_ERP2/vehicle_catalog_export.html")
    if html_path.exists():
        text = html_path.read_text(encoding="utf-8", errors="ignore")
        found = re.findall(r'data-brand="([^"]+)"', text, re.I)
        if not found:
            found = re.findall(r'<td>([A-Za-z0-9\s\-]+)</td>', text)
        for b in found:
            if len(b.strip()) > 1 and not b.startswith("<"):
                brands.add(b.strip().upper())

    # 2. Inspect frontend vehicle data files
    for p in Path("c:/ANTIGRAVITY/MC-LARENS_ERP2/frontend/src").rglob("*.js*"):
        try:
            content = p.read_text(encoding="utf-8", errors="ignore")
            matches = re.findall(r'brand:\s*["\']([^"\']+)["\']', content, re.I)
            for m in matches:
                if len(m.strip()) > 1:
                    brands.add(m.strip().upper())
        except Exception:
            pass

    print(f"Total marcas identificadas: {len(brands)}")
    sorted_brands = sorted(list(brands))
    for i, b in enumerate(sorted_brands, 1):
        print(f"{i}. {b}")

if __name__ == "__main__":
    extract_brands()
