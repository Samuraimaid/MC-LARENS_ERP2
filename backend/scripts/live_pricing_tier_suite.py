#!/usr/bin/env python3
"""Live E2E suite for pricing tiers, audit, search and document views."""
from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone

import httpx

API = os.getenv("ERP_API_BASE", "http://127.0.0.1:8001/api").rstrip("/")
PIN_PISO = os.getenv("PIN_PISO", "91010001")
PIN_VIP = os.getenv("PIN_VIP", "92010001")
PIN_SUPERVISOR = os.getenv("PIN_SUPERVISOR", "01011990")


def _login(pin: str) -> httpx.Client:
    client = httpx.Client(base_url=API, timeout=60.0)
    r = client.post("/auth/pin/login", json={"pin": pin})
    if r.status_code != 200:
        raise RuntimeError(f"PIN login failed {pin}: {r.status_code} {r.text}")
    return client


def _pick_customer(client: httpx.Client) -> dict:
    r = client.get("/customers", params={"limit": 5})
    r.raise_for_status()
    rows = r.json() if isinstance(r.json(), list) else r.json().get("rows") or r.json().get("customers") or []
    if not rows:
        raise RuntimeError("No customers available for tier suite")
    return rows[0]


def _pick_product(client: httpx.Client) -> dict:
    r = client.get("/products", params={"limit": 20})
    r.raise_for_status()
    products = r.json() if isinstance(r.json(), list) else r.json().get("products") or []
    for p in products:
        if float(p.get("precio1") or p.get("price") or 0) > 0:
            return p
    raise RuntimeError("No priced products found")


def run_suite() -> dict:
    report = {"started_at": datetime.now(timezone.utc).isoformat(), "steps": [], "ok": True}

    def step(name: str, ok: bool, detail: str = ""):
        report["steps"].append({"name": name, "ok": ok, "detail": detail})
        if not ok:
            report["ok"] = False
        print(f"[{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))

    try:
        piso = _login(PIN_PISO)
        vip = _login(PIN_VIP)
        supervisor = _login(PIN_SUPERVISOR)

        customer = _pick_customer(piso)
        product = _pick_product(piso)
        customer_id = customer.get("customer_id")

        ctx_r = piso.get("/pricing/sale-context", params={"customer_id": customer_id})
        step("pricing sale-context", ctx_r.status_code == 200, ctx_r.text[:120])
        ctx = ctx_r.json() if ctx_r.status_code == 200 else {}
        allowed = ctx.get("allowed_price_tiers") or []

        vip_ctx_r = vip.get("/pricing/sale-context", params={"customer_id": customer_id})
        vip_ctx = vip_ctx_r.json() if vip_ctx_r.status_code == 200 else {}
        step("vip context loads", vip_ctx_r.status_code == 200)
        step("vip seller_type", vip_ctx.get("seller_type") == "vip", str(vip_ctx.get("seller_type")))

        search_r = piso.get("/search/unified", params={"q": customer.get("name", "")[:6], "limit": 5})
        step("unified search", search_r.status_code == 200, f"total={search_r.json().get('total')}")

        if len(allowed) >= 2:
            alt_tier = allowed[1]
            quot_body = {
                "customer_id": customer_id,
                "items": [{
                    "product_id": product["product_id"],
                    "quantity": 1,
                    "unit_price": product.get("precio_vip") or product.get("precio2") or product.get("price"),
                    "with_installation": False,
                }],
                "discount": 0,
                "valid_days": 7,
                "currency": "USD",
                "active_price_tier": alt_tier,
                "audit_events": [{
                    "event_id": "evt_live_test",
                    "event_type": "tier_change",
                    "actor_name": "Live Suite",
                    "actor_role": "supervisor",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "visible_on_print": False,
                    "details": {"from_tier": "precio1", "to_tier": alt_tier},
                }],
            }
            q_r = supervisor.post("/quotations", json=quot_body)
            step("quotation with tier", q_r.status_code in (200, 201), q_r.text[:160])
            if q_r.status_code in (200, 201):
                qid = q_r.json().get("quotation_id")
                get_q = supervisor.get(f"/quotations/{qid}")
                step("get quotation detail", get_q.status_code == 200)
                has_audit = bool(get_q.json().get("audit_events")) if get_q.status_code == 200 else False
                step("quotation audit persisted", has_audit)
        else:
            step("quotation with tier", False, "insufficient allowed tiers")

        piso.close()
        vip.close()
        supervisor.close()
    except Exception as exc:
        step("suite exception", False, str(exc))

    report["finished_at"] = datetime.now(timezone.utc).isoformat()
    return report


if __name__ == "__main__":
    result = run_suite()
    out_path = os.path.join(
        os.path.dirname(__file__),
        "..",
        "data",
        f"live_pricing_tier_report_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}.json",
    )
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(result, fh, indent=2, ensure_ascii=False)
    print(f"Report: {out_path}")
    sys.exit(0 if result.get("ok") else 1)