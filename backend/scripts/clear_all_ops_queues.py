#!/usr/bin/env python3
"""CLI: clear all operational queues (wrapper around ops_queue_cleanup)."""
from __future__ import annotations

import json
import sys
from pathlib import Path

try:
    from backend.scripts.ops_queue_cleanup import run_full_queue_cleanup
except Exception:  # pragma: no cover
    from ops_queue_cleanup import run_full_queue_cleanup  # type: ignore


def main() -> int:
    print("=" * 64)
    print("LIMPIEZA TOTAL DE COLAS OPERATIVAS")
    print("=" * 64)
    report = run_full_queue_cleanup(deep=True)
    remaining = int(report.get("remaining_active_total") or 0)
    print("\n" + "=" * 64)
    print(f"RESUMEN remaining_active_total={remaining} ok={report.get('ok')}")
    if report.get("mongo", {}).get("after"):
        print(json.dumps(report["mongo"]["after"], indent=2, ensure_ascii=False))
    print("=" * 64)

    for path in (
        Path("/app/backend/data/clear_all_ops_queues_report.json"),
        Path("backend/data/clear_all_ops_queues_report.json"),
    ):
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
            print(f"Reporte: {path}")
            break
        except Exception:
            continue
    return 0 if report.get("ok") else 1


if __name__ == "__main__":
    sys.exit(main())
