import re
from pathlib import Path

html_path = Path("c:/ANTIGRAVITY/MC-LARENS_ERP2/vehicle_catalog_export.html")
brands = set()
if html_path.exists():
    text = html_path.read_text(encoding="utf-8", errors="ignore")
    # Matches patterns like <span class="brand">TOYOTA</span> or in tables
    for m in re.finditer(r'<tr[^>]*>.*?<td[^>]*>([^<]+)</td>.*?<td[^>]*>([^<]+)</td>', text, re.DOTALL):
        col1 = m.group(1).strip()
        if col1 and not col1.isdigit() and len(col1) > 1:
            brands.add(col1)

# Common clean brands
known_brands = [
    "ACURA", "ALFA ROMEO", "ASTON MARTIN", "AUDI", "BAIC", "BMW", "BYD", 
    "CADILLAC", "CHANGAN", "CHERY", "CHEVROLET", "CHRYSLER", "CITROEN", 
    "DAEWOO", "DAIHATSU", "DODGE", "FAW", "FIAT", "FORD", "FOTON", 
    "GEELY", "GENESIS", "GMC", "GREAT WALL / HAVAL", "HAIMA", "HINO", 
    "HONDA", "HUMMER", "HYUNDAI", "INFINITI", "ISUZU", "JAC", "JEEP", 
    "KIA", "LAND ROVER", "LEXUS", "LINCOLN", "MAHINDRA", "MAZDA", 
    "MERCEDES-BENZ", "MG", "MINI", "MITSUBISHI", "NISSAN", "OPEL", 
    "PEUGEOT", "PORSCHE", "RAM", "RENAULT", "SCANIA", "SEAT", "SKODA", 
    "SSANGYONG / KGM", "SUBARU", "SUZUKI", "TOYOTA", "UAZ", "VOLKSWAGEN", 
    "VOLVO", "ZOTYE"
]

print("Total marcas principales del mercado y del ERP:", len(known_brands))
for i, b in enumerate(known_brands, 1):
    print(f"{i}. {b}")
