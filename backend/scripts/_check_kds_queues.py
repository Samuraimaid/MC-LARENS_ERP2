#!/usr/bin/env python3
"""Inspect KDS boards and related active ops queues."""
from __future__ import annotations

import json
from collections import Counter
from typing import Any, Dict, List

import requests

API = "http://127.0.0.1:8001/api"


def show(name: str, data: Any) -> int:
    if isinstance(data, list):
        print(f"\n=== {name}: count={len(data)} ===")
        if data:
            by = Counter(str(x.get("status") or "?") for x in data)
            print("  by_status:", dict(by))
            for row in data[:10]:
                print(
                    "  -",
                    {
                        "id": row.get("work_order_id")
                        or row.get("tint_order_id")
                        or row.get("dispatch_id")
                        or row.get("id"),
                        "status": row.get("status"),
                        "assignment_status": row.get("assignment_status"),
                        "dept": row.get("department"),
                        "sale": row.get("sale_id") or row.get("invoice_number"),
                        "customer": row.get("customer_name"),
                    },
                )
            if len(data) > 10:
                print(f"  ... +{len(data) - 10} more")
        return len(data)

    if isinstance(data, dict):
        depts = data.get("departments") or {}
        print(f"\n=== {name}: board ===")
        print("  counts:", data.get("counts"))
        total = 0
        for k, rows in depts.items():
            n = len(rows) if isinstance(rows, list) else 0
            total += n
            print(f"  dept[{k}]={n}")
            if n:
                for row in rows[:5]:
                    print(
                        "   -",
                        row.get("work_order_id")
                        or row.get("tint_order_id")
                        or row.get("dispatch_id"),
                        row.get("status"),
                        row.get("customer_name"),
                    )
        return total

    print(name, type(data), str(data)[:200])
    return 0


def main() -> int:
    s = requests.Session()
    r = s.post(f"{API}/auth/pin/login", json={"pin": "01011990"}, timeout=30)
    r.raise_for_status()
    print("login", (r.json() or {}).get("user", {}).get("name"))

    paths = [
        "/kds/orders",
        "/kds/tint-orders",
        "/kds/warehouse",
        "/kds/board",
        "/work-orders",
        "/tint-orders",
        "/dispatch",
        "/quality-control/pending",
        "/coordinator/board",
    ]
    totals: Dict[str, int] = {}
    for path in paths:
        rr = s.get(f"{API}{path}", timeout=60)
        print(f"\nGET {path} -> {rr.status_code}")
        if rr.status_code != 200:
            print(rr.text[:250])
            totals[path] = -1
            continue
        totals[path] = show(path, rr.json())

    # Filter non-terminal from full lists
    for path, key in (
        ("/work-orders", "status"),
        ("/tint-orders", "status"),
        ("/dispatch", "status"),
    ):
        rr = s.get(f"{API}{path}", timeout=60)
        if rr.status_code != 200:
            continue
        rows = rr.json() if isinstance(rr.json(), list) else []
        active_statuses = {
            "pending",
            "pending_assignment",
            "in_progress",
            "quality_check",
            "partial",
            "assigned",
        }
        active = [x for x in rows if str(x.get("status") or "").lower() in active_statuses]
        print(f"\nACTIVE filter {path}: {len(active)} / total {len(rows)}")
        totals[f"{path}#active"] = len(active)

    print("\n======== SUMMARY ========")
    print(json.dumps(totals, indent=2))
    kds_sum = sum(
        max(v, 0)
        for k, v in totals.items()
        if k.startswith("/kds/") and k != "/kds/board"
    )
    print(f"kds_endpoint_items_sum={kds_sum}")
    print(f"kds_board_total={totals.get('/kds/board')}")
    needs = kds_sum > 0 or (totals.get("/kds/board") or 0) > 0
    print("NEEDS_CLEANUP=" + ("YES" if needs else "NO"))
    return 1 if needs else 0


if __name__ == "__main__":
    raise SystemExit(main())
