#!/usr/bin/env python3
"""Validación funcional pre-go-live: RRHH, reportes, polarizados y rendimiento."""
from __future__ import annotations

import json
import subprocess
import sys
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Tuple

import requests

API_BASE = "http://127.0.0.1:8001/api"
PIN_GERENCIA = "01011990"
REPORT_DIR = Path(__file__).resolve().parents[1] / "data"
REPORT_DIR.mkdir(parents=True, exist_ok=True)
RUN_TAG = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")

REPORT: Dict[str, Any] = {"run_tag": RUN_TAG, "ok": [], "failed": [], "warnings": []}

# Umbrales orientados a tablets modestas (ms)
LATENCY_WARN_MS = 2500
LATENCY_FAIL_MS = 8000
CATALOG_WARN_BYTES = 1_500_000


def log_ok(phase: str, msg: str) -> None:
    print(f"OK [{phase}]: {msg}")
    REPORT["ok"].append({"phase": phase, "msg": msg})


def log_warn(phase: str, msg: str) -> None:
    print(f"WARN [{phase}]: {msg}")
    REPORT["warnings"].append({"phase": phase, "msg": msg})


def log_fail(phase: str, msg: str, detail: str = "") -> None:
    print(f"FAIL [{phase}]: {msg}")
    if detail:
        print(f"  {detail}")
    REPORT["failed"].append({"phase": phase, "msg": msg, "detail": detail})


class ApiClient:
    def __init__(self) -> None:
        self.session = requests.Session()

    def login(self, pin: str) -> Dict[str, Any]:
        r = self.session.post(f"{API_BASE}/auth/pin/login", json={"pin": pin}, timeout=30)
        if r.status_code != 200:
            raise RuntimeError(f"Login: {r.status_code} {r.text[:300]}")
        return r.json().get("user") or {}

    def timed_get(self, path: str, **kwargs) -> Tuple[requests.Response, float]:
        start = time.perf_counter()
        resp = self.session.get(f"{API_BASE}{path}", timeout=120, **kwargs)
        elapsed_ms = (time.perf_counter() - start) * 1000
        return resp, elapsed_ms


def phase_hr(client: ApiClient) -> bool:
    phase = "hr"
    ok = True
    checks = [
        ("/hr/summary", None),
        ("/hr/tools/audit-schedule", None),
        ("/hr/attendance/reports/biweekly", {"reference_date": date.today().isoformat()}),
        ("/hr/payroll-adjustments", {"limit": 5}),
    ]
    for path, params in checks:
        try:
            r, ms = client.timed_get(path, params=params)
            if r.status_code != 200:
                log_fail(phase, f"{path} status {r.status_code}", r.text[:200])
                ok = False
                continue
            log_ok(phase, f"{path} OK ({ms:.0f} ms)")
            if ms > LATENCY_WARN_MS:
                log_warn(phase, f"{path} lento: {ms:.0f} ms")
        except Exception as exc:
            log_fail(phase, f"{path} error", str(exc))
            ok = False
    return ok


def phase_reports(client: ApiClient) -> bool:
    phase = "reports"
    end = date.today()
    start = end - timedelta(days=30)
    params = {"start_date": start.isoformat(), "end_date": end.isoformat()}
    ok = True
    for path in ("/reports/sales", "/reports/installations", "/reports/productivity"):
        try:
            r, ms = client.timed_get(path, params=params)
            if r.status_code != 200:
                log_fail(phase, f"{path} status {r.status_code}", r.text[:200])
                ok = False
                continue
            payload = r.json()
            keys = ", ".join(sorted(payload.keys())[:6])
            log_ok(phase, f"{path} OK ({ms:.0f} ms) keys={keys}")
            if ms > LATENCY_WARN_MS:
                log_warn(phase, f"{path} lento: {ms:.0f} ms")
        except Exception as exc:
            log_fail(phase, f"{path} error", str(exc))
            ok = False
    return ok


def phase_tint(client: ApiClient) -> bool:
    phase = "tint"
    ok = True
    checks = [
        ("/kds/tint-orders", None),
        ("/tint-orders/materials/list", None),
    ]
    for path, params in checks:
        try:
            r, ms = client.timed_get(path, params=params)
            if r.status_code != 200:
                log_fail(phase, f"{path} status {r.status_code}", r.text[:200])
                ok = False
                continue
            data = r.json()
            count = len(data) if isinstance(data, list) else len(data.keys()) if isinstance(data, dict) else 0
            log_ok(phase, f"{path} OK ({ms:.0f} ms, items={count})")
        except Exception as exc:
            log_fail(phase, f"{path} error", str(exc))
            ok = False
    return ok


def phase_performance(client: ApiClient) -> bool:
    phase = "performance"
    ok = True
    heavy_paths = [
        "/sales",
        "/inventory",
        "/products",
        "/vehicles",
    ]
    for path in heavy_paths:
        try:
            r, ms = client.timed_get(path, params={"limit": 50})
            if r.status_code != 200:
                log_fail(phase, f"{path} status {r.status_code}")
                ok = False
                continue
            if ms > LATENCY_FAIL_MS:
                log_fail(phase, f"{path} demasiado lento", f"{ms:.0f} ms")
                ok = False
            elif ms > LATENCY_WARN_MS:
                log_warn(phase, f"{path} lento para tablet: {ms:.0f} ms")
            else:
                log_ok(phase, f"{path} {ms:.0f} ms")
        except Exception as exc:
            log_fail(phase, f"{path} error", str(exc))
            ok = False

    repo_root = Path(__file__).resolve().parents[2]
    catalog = repo_root / "frontend" / "src" / "data" / "vehicleCatalog.json"
    if catalog.exists():
        size = catalog.stat().st_size
        if size > CATALOG_WARN_BYTES:
            log_warn(phase, f"vehicleCatalog.json grande: {size / 1024 / 1024:.2f} MB")
        else:
            log_ok(phase, f"vehicleCatalog.json {size / 1024:.0f} KB")
    else:
        log_warn(phase, "vehicleCatalog.json no encontrado en frontend")

    build_index = repo_root / "frontend" / "build" / "index.html"
    if build_index.exists():
        log_ok(phase, f"build frontend presente ({build_index.stat().st_size} bytes index.html)")
    else:
        log_warn(phase, "Sin build de producción local; tablets usarán bundle del contenedor")

    return ok


def _run_pytest(test_paths: List[str]) -> subprocess.CompletedProcess[str]:
    repo_root = Path(__file__).resolve().parents[2]
    args = ["-m", "pytest", *test_paths, "-q", "--tb=short", "-o", "addopts="]
    try:
        import pytest  # noqa: F401

        return subprocess.run(
            [sys.executable, *args],
            cwd=str(repo_root),
            capture_output=True,
            text=True,
        )
    except ImportError:
        docker_args = ["docker", "exec", "mundo-backend", "python", *args]
        return subprocess.run(docker_args, capture_output=True, text=True)


def phase_payroll_unit() -> bool:
    phase = "payroll_unit"
    result = _run_pytest(["backend/tests/test_payroll_periods.py"])
    if result.returncode == 0:
        log_ok(phase, "Quincenas 9/24 validadas (pytest)")
        return True
    log_fail(phase, "test_payroll_periods.py falló", (result.stdout or result.stderr)[-400:])
    return False


def main() -> int:
    print("=" * 72)
    print(f"GO-LIVE VALIDATION SUITE — {RUN_TAG}")
    print("=" * 72)

    client = ApiClient()
    try:
        user = client.login(PIN_GERENCIA)
        log_ok("auth", f"Gerencia: {user.get('name', 'ok')}")
    except Exception as exc:
        log_fail("auth", "Login gerencia", str(exc))
        _write_report()
        return 1

    results = [
        phase_hr(client),
        phase_reports(client),
        phase_tint(client),
        phase_performance(client),
        phase_payroll_unit(),
    ]

    print("\n" + "=" * 72)
    print("RESUMEN VALIDACIÓN")
    print("=" * 72)
    print(f"OK: {len(REPORT['ok'])} | WARN: {len(REPORT['warnings'])} | FAIL: {len(REPORT['failed'])}")
    _write_report()
    return 0 if all(results) and not REPORT["failed"] else 1


def _write_report() -> None:
    out = REPORT_DIR / f"go_live_validation_report_{RUN_TAG}.json"
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(REPORT, fh, ensure_ascii=False, indent=2)
    print(f"\nReporte JSON: {out}")


if __name__ == "__main__":
    sys.exit(main())