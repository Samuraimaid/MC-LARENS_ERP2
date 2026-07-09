"""Formal cash session close with physical count matching theoretical cash."""
from __future__ import annotations

import json
import sys
from typing import Any, Dict, List

import httpx

BASE = "http://127.0.0.1:8001/api"
PIN_CAJERO = "11223344"
PIN_GERENCIA = "01011990"
TARGET_NIO = 946429.43
TARGET_USD = 10544.33


def _physical_rows(nio: float, usd: float) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    if nio > 0:
        rows.append(
            {
                "valor_nominal": round(nio, 2),
                "cantidad": 1,
                "tipo": "total",
                "moneda": "NIO",
            }
        )
    if usd > 0:
        rows.append(
            {
                "valor_nominal": round(usd, 2),
                "cantidad": 1,
                "tipo": "total",
                "moneda": "USD",
            }
        )
    return rows


def main() -> int:
    client = httpx.Client(timeout=120.0, follow_redirects=True)
    client.post(f"{BASE}/auth/pin/login", json={"pin": PIN_CAJERO})

    session_payload = client.get(f"{BASE}/caja/sesion-activa").json()
    session = session_payload.get("session") or session_payload
    session_id = str(session.get("session_id") or "")
    if not session_id:
        print(json.dumps({"ok": False, "error": "No hay sesión de caja activa"}, indent=2))
        return 1

    arqueo_before = client.get(
        f"{BASE}/caja/arqueo/{session_id}",
        params={"include_theoretical": True},
    )
    if arqueo_before.status_code != 200:
        print(json.dumps({"ok": False, "error": arqueo_before.text[:500]}, indent=2))
        return 1

    before = arqueo_before.json()
    expected = before.get("expected_by_currency") or {}
    nio_expected = float(expected.get("NIO") or TARGET_NIO)
    usd_expected = float(expected.get("USD") or TARGET_USD)

    rates = client.get(f"{BASE}/currencies/usd-nio-dual")
    buy_rate = 36.62
    if rates.status_code == 200:
        buy_rate = float(rates.json().get("buy_rate") or buy_rate)

    close_response = client.post(
        f"{BASE}/caja/cierre",
        json={
            "sesion_id": session_id,
            "conteo_fisico": _physical_rows(nio_expected, usd_expected),
            "tipo_cambio_usd_nio": buy_rate,
            "observaciones": "Cierre formal auditoría QA — conteo físico = teórico efectivo",
        },
    )
    if close_response.status_code not in {200, 201}:
        print(
            json.dumps(
                {
                    "ok": False,
                    "step": "cierre",
                    "status": close_response.status_code,
                    "body": close_response.text[:800],
                },
                indent=2,
            )
        )
        return 1

    close_doc = close_response.json()

    gerencia = httpx.Client(timeout=120.0, follow_redirects=True)
    gerencia.post(f"{BASE}/auth/pin/login", json={"pin": PIN_GERENCIA})
    report_response = gerencia.get(f"{BASE}/caja/cierre/{session_id}/reporte-gerencia")
    gerencia.close()

    report: Dict[str, Any] = {}
    if report_response.status_code == 200:
        report = report_response.json()

    theo = report.get("theoretical") or {}
    comparativo = theo.get("comparativo") or {}
    session_info = report.get("session") or {}

    result = {
        "ok": True,
        "session_id": session_id,
        "buy_rate_used": buy_rate,
        "arqueo_before": {
            "usd_to_nio_rate": before.get("usd_to_nio_rate"),
            "expected_by_currency": expected,
            "saldo_teorico_nio": before.get("saldo_teorico_nio"),
        },
        "cierre": {
            "diferencia_nio": close_doc.get("diferencia_nio"),
            "diferencia_tipo": close_doc.get("diferencia_tipo"),
            "difference_by_currency": close_doc.get("difference_by_currency"),
            "expected_by_currency": close_doc.get("expected_by_currency"),
            "physical_by_currency": close_doc.get("closing_totals"),
            "saldo_teorico_nio": close_doc.get("saldo_teorico_nio"),
            "total_fisico_nio": close_doc.get("total_fisico_nio"),
        },
        "reporte_gerencia": {
            "status": report_response.status_code,
            "diferencia_tipo": session_info.get("diferencia_tipo"),
            "diferencia_nio": session_info.get("diferencia_nio"),
            "comparativo": comparativo,
            "cuadrado": (
                abs(float((comparativo.get("nio") or {}).get("diferencia") or 0)) < 0.02
                and abs(float((comparativo.get("usd") or {}).get("diferencia") or 0)) < 0.02
                and str(session_info.get("diferencia_tipo") or "").lower() == "cuadrado"
            ),
        },
    }
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 0 if result["reporte_gerencia"]["cuadrado"] else 1


if __name__ == "__main__":
    sys.exit(main())