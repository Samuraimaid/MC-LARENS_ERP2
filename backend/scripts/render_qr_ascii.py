#!/usr/bin/env python3
"""Renderiza un codigo QR escaneable como arte ASCII de consola (bloques dobles)."""
from __future__ import annotations

import sys

try:
    import qrcode
except ImportError:
    print("[ERROR] Modulo qrcode no instalado. Ejecute: pip install qrcode", file=sys.stderr)
    sys.exit(2)


def render_url(url: str) -> None:
    qr = qrcode.QRCode(version=None, error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=1, border=2)
    qr.add_data(url)
    qr.make(fit=True)
    print()
    print(f" URL ERP: {url}")
    print(" Escanee con la camara del celular desde esta pantalla")
    print()
    for row in qr.modules:
        upper = "".join("█" if cell else " " for cell in row)
        lower = upper
        line = "".join(f"{u}{l}" for u, l in zip(upper, lower))
        print(line)
    print()


def main() -> int:
    url = sys.argv[1] if len(sys.argv) > 1 else "http://192.168.1.26:3000"
    render_url(url.strip())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())