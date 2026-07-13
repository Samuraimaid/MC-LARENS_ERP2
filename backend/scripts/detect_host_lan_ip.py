#!/usr/bin/env python3
"""Detect host LAN IPv4 and persist it for Docker appliance dashboards."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.domains.deployment.lan_identity import detect_primary_lan_ipv4, resolve_lan_ip


def main() -> int:
    ip, source = resolve_lan_ip()
    detected = detect_primary_lan_ipv4() or ip
    target = Path(__file__).resolve().parents[1] / "data" / "host_lan_ip.txt"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(f"{detected}\n", encoding="utf-8")
    print(f"[detect_host_lan_ip] {detected} ({source}) -> {target}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())