import re
from pathlib import Path

def check_jsx_files():
    src_dir = Path("c:/ANTIGRAVITY/MC-LARENS_ERP2/frontend/src")
    errors = []
    
    for p in src_dir.rglob("*.jsx"):
        text = p.read_text(encoding="utf-8", errors="ignore")
        # Check for unescaped / poorly escaped quotes in JSX attributes like attr="...\"..."
        bad_attrs = re.findall(r'(\w+=\"[^\"]*\\\"[^\"]*\")', text)
        if bad_attrs:
            errors.append((p.name, bad_attrs))
            
    print(f"Total archivos con posibles errores de atributos JSX: {len(errors)}")
    for name, errs in errors:
        print(f"  {name}: {errs}")

if __name__ == "__main__":
    check_jsx_files()
