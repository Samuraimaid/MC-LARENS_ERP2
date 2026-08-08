#!/usr/bin/env python3
"""Security / policy probes for ERP sales→ops flow. Writes JSON report."""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

import requests

API = "http://127.0.0.1:8001/api"
FINDINGS: List[Dict[str, Any]] = []


def add(area: str, title: str, severity: str, **extra: Any) -> None:
    FINDINGS.append({"area": area, "title": title, "severity": severity, **extra})


def login(pin: str):
    s = requests.Session()
    r = s.post(f"{API}/auth/pin/login", json={"pin": pin}, timeout=30)
    if r.status_code != 200:
        raise RuntimeError(f"login failed {pin}: {r.status_code} {r.text[:200]}")
    return s, (r.json() or {}).get("user") or {}


def main() -> int:
    # 1) Anonymous access
    anon = requests.Session()
    for path in [
        "/sales",
        "/customers",
        "/products",
        "/inventory",
        "/caja/facturas",
        "/users",
        "/settings/dialog-messages",
        "/drafts/sale",
        "/quality-control",
        "/auth/pin/users",
    ]:
        r = anon.get(f"{API}{path}", timeout=15)
        sev = "critical" if r.status_code == 200 else "info"
        add("auth_anon", f"GET {path} sin auth → {r.status_code}", sev, status=r.status_code)

    # 2) Role logins
    s_v, u_v = login("55667788")
    s_c, u_c = login("11223344")
    s_g, u_g = login("01011990")
    add("login", "ventas", "info", user=u_v.get("name"), role=u_v.get("role"))
    add("login", "cajero", "info", user=u_c.get("name"), role=u_c.get("role"))
    add("login", "gerencia", "info", user=u_g.get("name"), role=u_g.get("role"))

    # 3) Privilege escalation probes as ventas
    for path in [
        "/caja/facturas",
        "/users",
        "/quality-control",
        "/quality-control/pending",
        "/dispatch",
        "/work-orders",
        "/settings/billing",
        "/reports/sales",
        "/auth/pin/users",
    ]:
        r = s_v.get(f"{API}{path}", timeout=20)
        # 200 with sensitive data = high; 403 = ok
        if r.status_code == 200:
            body = r.json()
            size = len(body) if isinstance(body, list) else (len(body.get("rows") or body.get("drafts") or []) if isinstance(body, dict) else 1)
            add("authz_ventas", f"Ventas accede GET {path}", "high", status=200, size=size)
        elif r.status_code in (401, 403):
            add("authz_ventas", f"Ventas bloqueado GET {path}", "ok", status=r.status_code)
        else:
            add("authz_ventas", f"Ventas GET {path} → {r.status_code}", "medium", status=r.status_code, detail=r.text[:120])

    # 4) Self-release draft
    drafts = s_v.get(f"{API}/drafts/sale", timeout=30).json()
    own = drafts.get("drafts") or []
    if own:
        did = own[0].get("id")
        r = s_v.post(f"{API}/drafts/sale/{did}/review/release", timeout=20)
        sev = "high" if r.status_code == 200 else "ok"
        add("draft_security", "Ventas intenta liberar su propio borrador (review/release)", sev, status=r.status_code, detail=r.text[:160])
        r2 = s_v.post(f"{API}/drafts/sale/{did}/review/watch", timeout=20)
        sev2 = "high" if r2.status_code == 200 else "ok"
        add("draft_security", "Ventas intenta watch de borrador", sev2, status=r2.status_code, detail=r2.text[:160])

    # 5) Precio 2 sin aprobación
    customers = s_v.get(f"{API}/customers", timeout=30).json()
    products = s_v.get(f"{API}/products", timeout=30).json()
    if customers and products:
        p = next((x for x in products if float(x.get("precio2") or 0) > 0), products[0])
        c = customers[0]
        unit = float(p.get("precio2") or p.get("price") or 100)
        total = round(unit * 36.5 * 1.15, 2)
        payload = {
            "customer_id": c.get("customer_id"),
            "items": [{
                "product_id": p.get("product_id"),
                "quantity": 1,
                "discount": 0,
                "unit_price": unit,
                "warehouse_id": "wh_main",
                "with_installation": False,
            }],
            "discount": 0,
            "payment_type": "cash",
            "payment_method": "cash",
            "apply_iva": True,
            "iva_rate": 15,
            "currency": "NIO",
            "exchange_rate": 36.5,
            "total_amount": total,
            "planned_payment_plan": {
                "mode": "cash",
                "lines": [{"metodo": "cash", "moneda": "NIO", "monto_origen": total}],
            },
            "notes": "AUDIT precio2 sin approval",
        }
        r = s_v.post(f"{API}/sales", json=payload, timeout=60)
        sev = "critical" if r.status_code == 200 else "ok"
        add("pricing", "Venta con Precio 2 sin aprobación", sev, status=r.status_code, detail=r.text[:220])

    # 6) Oversell
    if customers and products:
        p = products[0]
        unit = float(p.get("precio1") or p.get("price") or 100)
        total = round(unit * 9999 * 36.5 * 1.15, 2)
        payload = {
            "customer_id": customers[0].get("customer_id"),
            "items": [{
                "product_id": p.get("product_id"),
                "quantity": 9999,
                "discount": 0,
                "unit_price": unit,
                "warehouse_id": "wh_main",
                "with_installation": False,
            }],
            "discount": 0,
            "payment_type": "cash",
            "payment_method": "cash",
            "apply_iva": True,
            "iva_rate": 15,
            "currency": "NIO",
            "exchange_rate": 36.5,
            "total_amount": total,
            "planned_payment_plan": {
                "mode": "cash",
                "lines": [{"metodo": "cash", "moneda": "NIO", "monto_origen": total}],
            },
            "notes": "AUDIT oversell",
        }
        r = s_v.post(f"{API}/sales", json=payload, timeout=60)
        sev = "critical" if r.status_code == 200 else "ok"
        add("inventory", "Oversell qty=9999 al crear venta", sev, status=r.status_code, detail=r.text[:220])

    # 7) Negative price
    if customers and products:
        p = products[0]
        payload = {
            "customer_id": customers[0].get("customer_id"),
            "items": [{
                "product_id": p.get("product_id"),
                "quantity": 1,
                "discount": 0,
                "unit_price": -50,
                "warehouse_id": "wh_main",
                "with_installation": False,
            }],
            "discount": 0,
            "payment_type": "cash",
            "payment_method": "cash",
            "apply_iva": True,
            "iva_rate": 15,
            "currency": "NIO",
            "exchange_rate": 36.5,
            "total_amount": -1,
            "planned_payment_plan": {
                "mode": "cash",
                "lines": [{"metodo": "cash", "moneda": "NIO", "monto_origen": -1}],
            },
            "notes": "AUDIT negative price",
        }
        r = s_v.post(f"{API}/sales", json=payload, timeout=60)
        sev = "critical" if r.status_code == 200 else "ok"
        add("pricing", "Venta con unit_price negativo", sev, status=r.status_code, detail=r.text[:220])

    # 8) TOTAL mismatch (client understates total)
    if customers and products:
        p = products[0]
        unit = float(p.get("precio1") or p.get("price") or 100)
        real_total = round(unit * 36.5 * 1.15, 2)
        payload = {
            "customer_id": customers[0].get("customer_id"),
            "items": [{
                "product_id": p.get("product_id"),
                "quantity": 1,
                "discount": 0,
                "unit_price": unit,
                "warehouse_id": "wh_main",
                "with_installation": False,
            }],
            "discount": 0,
            "payment_type": "cash",
            "payment_method": "cash",
            "apply_iva": True,
            "iva_rate": 15,
            "currency": "NIO",
            "exchange_rate": 36.5,
            "total_amount": 1.0,
            "planned_payment_plan": {
                "mode": "cash",
                "lines": [{"metodo": "cash", "moneda": "NIO", "monto_origen": 1.0}],
            },
            "notes": "AUDIT total mismatch",
        }
        r = s_v.post(f"{API}/sales", json=payload, timeout=60)
        sev = "critical" if r.status_code == 200 else "ok"
        add(
            "finance",
            "TOTAL_MISMATCH: client envía total_amount=1",
            sev,
            status=r.status_code,
            expected_around=real_total,
            detail=r.text[:220],
        )

    # 9) Cajero can cancel without gerencia?
    open_inv = s_c.get(f"{API}/caja/facturas", params={"tab": "abiertas", "limit": 5}, timeout=30)
    if open_inv.status_code == 200:
        rows = (open_inv.json() or {}).get("rows") or []
        if rows:
            sid = rows[0].get("sale_id")
            r = s_c.post(
                f"{API}/caja/facturas/{sid}/anular",
                json={
                    "motivo": "probe",
                    "justificacion_interna": "security probe cancel",
                    "autorizado_por": u_c.get("user_id"),
                },
                timeout=30,
            )
            # don't actually want to cancel - if 200 it's a finding; if it cancelled we log
            sev = "high" if r.status_code == 200 else "ok"
            add("caja", "Cajero anula factura abierta", sev, status=r.status_code, detail=r.text[:160], sale_id=sid)

    # 10) Work orders / QC state
    wo = s_g.get(f"{API}/work-orders", timeout=30)
    if wo.status_code == 200:
        orders = wo.json() if isinstance(wo.json(), list) else []
        by_status: Dict[str, int] = {}
        for o in orders:
            st = str(o.get("status") or o.get("state") or "unknown")
            by_status[st] = by_status.get(st, 0) + 1
        add("ops", "Work orders snapshot", "info", total=len(orders), by_status=by_status)

    qc = s_g.get(f"{API}/quality-control/pending", timeout=30)
    add("ops", "QC pending", "info", status=qc.status_code, detail=str(qc.json())[:300] if qc.status_code == 200 else qc.text[:150])

    # 11) IDOR style: ventas fetch sale by id from cajero open list
    if open_inv.status_code == 200:
        rows = (open_inv.json() or {}).get("rows") or open_inv.json() or []
        if isinstance(rows, dict):
            rows = rows.get("rows") or []
        if rows:
            sid = rows[0].get("sale_id")
            r = s_v.get(f"{API}/sales/{sid}", timeout=20)
            add("idor", f"Ventas lee sale ajena/abierta {sid}", "medium" if r.status_code == 200 else "ok", status=r.status_code)

    # 12) Double collect probe structure
    session = s_c.get(f"{API}/caja/sesion-activa", timeout=20)
    add("caja", "Sesión caja activa", "info", status=session.status_code, detail=str(session.json())[:200] if session.status_code == 200 else session.text[:120])

    # 13) Zero / negative quantity
    if customers and products:
        p = products[0]
        unit = float(p.get("precio1") or p.get("price") or 100)
        for qty, label in [(0, "qty=0"), (-3, "qty=-3")]:
            payload = {
                "customer_id": customers[0].get("customer_id"),
                "items": [{
                    "product_id": p.get("product_id"),
                    "quantity": qty,
                    "discount": 0,
                    "unit_price": unit,
                    "warehouse_id": "wh_main",
                    "with_installation": False,
                }],
                "discount": 0,
                "payment_type": "cash",
                "payment_method": "cash",
                "apply_iva": True,
                "iva_rate": 15,
                "currency": "NIO",
                "exchange_rate": 36.5,
                "notes": f"AUDIT {label}",
            }
            r = s_v.post(f"{API}/sales", json=payload, timeout=60)
            sev = "critical" if r.status_code == 200 else "ok"
            add("inventory", f"Venta con {label}", sev, status=r.status_code, detail=r.text[:180])

    # 14) session_id alias on collect payload (should not 422)
    if session.status_code == 200 and (session.json() or {}).get("active"):
        open_rows = (open_inv.json() or {}).get("rows") or [] if open_inv.status_code == 200 else []
        if open_rows:
            sid = open_rows[0].get("sale_id")
            ses = (session.json() or {}).get("session") or {}
            ses_id = ses.get("session_id") or ses.get("sesion_id")
            # Do not actually double-collect; only validate alias acceptance vs missing field
            r = s_c.post(
                f"{API}/caja/facturas/{sid}/cobrar",
                json={
                    "session_id": ses_id,  # alias of sesion_id
                    "amount": 0.01,
                    "metodo": "cash",
                    "notes": "AUDIT alias probe — should fail amount/state not schema",
                },
                timeout=30,
            )
            # 422 = alias still broken; 400/409 = accepted schema (business rule fail OK)
            sev = "high" if r.status_code == 422 else "ok"
            add("caja", "Alias session_id/metodo en cobro", sev, status=r.status_code, detail=r.text[:180])

    # 15) WO completed without QC must be blocked
    wo_list = s_g.get(f"{API}/work-orders", timeout=30)
    if wo_list.status_code == 200:
        orders = wo_list.json() if isinstance(wo_list.json(), list) else []
        candidate = next(
            (
                o
                for o in orders
                if str(o.get("status") or "") in {"pending", "in_progress", "quality_check"}
                and not o.get("qc_approved")
            ),
            None,
        )
        if candidate:
            wid = candidate.get("work_order_id")
            r = s_g.put(f"{API}/work-orders/{wid}", json={"status": "completed"}, timeout=30)
            sev = "critical" if r.status_code == 200 else "ok"
            add("ops", "PUT completed sin QC formal", sev, status=r.status_code, detail=r.text[:200], work_order_id=wid)

    # 16) Edit request on paid sale should be blocked
    paid = s_g.get(f"{API}/sales", params={"limit": 20}, timeout=30)
    if paid.status_code == 200:
        sales = paid.json() if isinstance(paid.json(), list) else (paid.json() or {}).get("sales") or []
        paid_sale = next((s for s in sales if str(s.get("payment_status") or "").lower() == "paid"), None)
        if paid_sale:
            r = s_v.post(
                f"{API}/sales/{paid_sale.get('sale_id')}/requests/edit",
                json={"reason": "AUDIT intento editar factura ya pagada debe bloquearse"},
                timeout=30,
            )
            sev = "high" if r.status_code == 200 else "ok"
            add("finance", "Edit request sobre factura paid", sev, status=r.status_code, detail=r.text[:160])

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "findings": FINDINGS,
        "summary": {
            "critical": sum(1 for f in FINDINGS if f["severity"] == "critical"),
            "high": sum(1 for f in FINDINGS if f["severity"] == "high"),
            "medium": sum(1 for f in FINDINGS if f["severity"] == "medium"),
            "ok": sum(1 for f in FINDINGS if f["severity"] == "ok"),
            "info": sum(1 for f in FINDINGS if f["severity"] == "info"),
        },
    }
    out = Path("/app/backend/data") / f"audit_security_probe_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}.json"
    try:
        out.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
        report["report_path"] = str(out)
    except Exception:
        local = Path("backend/data") / f"audit_security_probe_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}.json"
        local.parent.mkdir(parents=True, exist_ok=True)
        local.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
        report["report_path"] = str(local)

    print(json.dumps(report, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
