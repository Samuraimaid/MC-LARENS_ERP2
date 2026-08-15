#!/usr/bin/env python3
"""Detect host LAN IPv4 and persist it for Docker appliance dashboards.

Run on the Windows host (not inside the container) so Wi-Fi/Ethernet is visible:
  python backend/scripts/detect_host_lan_ip.py

Docker entrypoint and the server dashboard read backend/data/host_lan_ip.txt.
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.domains.deployment.lan_identity import (  # noqa: E402
    detect_primary_lan_ipv4,
    refresh_host_lan_ip,
    resolve_lan_ip,
    write_host_lan_ip_file,
)


def main() -> int:
    detected = detect_primary_lan_ipv4()
    if detected:
        path = write_host_lan_ip_file(detected)
        print(f"[detect_host_lan_ip] {detected} (detected) -> {path}")
        return 0

    ip, source = refresh_host_lan_ip()
    # fallback path message
    target = Path(__file__).resolve().parents[1] / "data" / "host_lan_ip.txt"
    print(f"[detect_host_lan_ip] {ip} ({source}) -> {target}")
    if source == "factory_default":
        print(
            "[detect_host_lan_ip] WARNING: no live LAN IP found; "
            "factory default may be wrong for this network.",
            file=sys.stderr,
        )
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
