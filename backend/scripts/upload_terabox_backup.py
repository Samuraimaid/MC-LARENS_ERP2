#!/usr/bin/env python3
"""Upload latest delta backup archive to TeraBox (fire-and-forget CLI)."""
from __future__ import annotations

import sys

from backend.services.terabox_backup_service import upload_archive_to_terabox_sync


def main() -> int:
    if len(sys.argv) < 2:
        print("[terabox] Uso: upload_terabox_backup.py /ruta/archivo.tar.gz", file=sys.stderr)
        return 2
    result = upload_archive_to_terabox_sync(sys.argv[1])
    print(f"[terabox] {result.get('message')} status={result.get('last_upload_status')}")
    return 0 if result.get("last_upload_status") == "success" else 1


if __name__ == "__main__":
    raise SystemExit(main())