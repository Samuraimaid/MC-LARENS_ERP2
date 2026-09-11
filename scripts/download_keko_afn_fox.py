import urllib.request
import json
import os
from pathlib import Path

RAW_BASE = "https://raw.githubusercontent.com/Samuraimaid/MC-LARENS_ERP2/master"

CATALOG_FILES = {
    "catalogos/KEKO": [
        "catalogo.json",
        "catalogo_matched.json",
        "catalogo_universal.json",
        "catalogo_unmatched.json",
        "README.md"
    ],
    "catalogos/AFN": [
        "catalogo.json",
        "catalogo_matched.json",
        "catalogo_universal.json",
        "catalogo_unmatched.json",
        "README.md"
    ],
    "catalogos/Fox": [
        "catalogo.json",
        "catalogo_matched.json",
        "catalogo_universal.json",
        "catalogo_unmatched.json",
        "README.md"
    ]
}

def download(rel_path):
    url = f"{RAW_BASE}/{rel_path.replace(os.sep, '/')}"
    local_path = Path(rel_path)
    local_path.parent.mkdir(parents=True, exist_ok=True)
    print(f"Downloading {url} -> {local_path}...", flush=True)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req) as resp:
            content = resp.read()
            local_path.write_bytes(content)
        print(f"  OK: {local_path} ({len(content)} bytes)", flush=True)
        return True
    except Exception as e:
        print(f"  FAILED {rel_path}: {e}", flush=True)
        return False

def main():
    for base_dir, filenames in CATALOG_FILES.items():
        for fn in filenames:
            rel = f"{base_dir}/{fn}"
            download(rel)

if __name__ == "__main__":
    main()
