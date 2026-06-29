#!/usr/bin/env python3
"""Orquestador: tests unitarios de plan + suites live end-to-end."""
from __future__ import annotations

import json
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "backend" / "data"
RUN_TAG = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")

LIVE_SCRIPTS = [
    "backend/scripts/live_full_workflow_suite.py",
    "backend/scripts/live_payment_plan_flow_test.py",
    "backend/scripts/live_supervisor_draft_form_test.py",
    "backend/scripts/e2e_cashier_features.py",
]

UNIT_TESTS = [
    "backend/tests/test_planned_payment_plan.py",
    "backend/tests/test_e2e_sale_helpers.py",
]


def run_command(label: str, cmd: list[str]) -> dict:
    print(f"\n=== {label} ===")
    proc = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True)
    if proc.stdout:
        print(proc.stdout)
    if proc.stderr:
        print(proc.stderr)
    return {
        "label": label,
        "cmd": cmd,
        "exit_code": proc.returncode,
        "stdout_tail": proc.stdout[-2000:],
        "stderr_tail": proc.stderr[-1000:],
    }


def wait_for_api(base_url: str = "http://127.0.0.1:8001/api/", timeout_sec: int = 90) -> None:
    deadline = time.time() + timeout_sec
    while time.time() < deadline:
        try:
            response = requests.get(base_url, timeout=5)
            if response.status_code == 200:
                return
        except requests.RequestException:
            pass
        time.sleep(2)
    raise RuntimeError(f"API no disponible en {base_url}")


def main() -> int:
    report = {"run_tag": RUN_TAG, "steps": [], "failed": []}

    try:
        wait_for_api()
        print("API lista para suites live")
    except RuntimeError as exc:
        print(str(exc))
        report["failed"].append("api_preflight")

    unit = run_command(
        "unit_planned_payment_plan",
        [sys.executable, "-m", "pytest", *UNIT_TESTS, "-q"],
    )
    report["steps"].append(unit)
    if unit["exit_code"] != 0:
        report["failed"].append(unit["label"])

    if "api_preflight" not in report["failed"]:
        for script in LIVE_SCRIPTS:
            step = run_command(script, [sys.executable, script])
            report["steps"].append(step)
            if step["exit_code"] != 0:
                report["failed"].append(step["label"])

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    report_path = DATA_DIR / f"live_e2e_runner_report_{RUN_TAG}.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    passed = len(report["steps"]) - len(report["failed"])
    print(json.dumps({
        "passed_steps": passed,
        "failed_steps": len(report["failed"]),
        "failed": report["failed"],
        "report": str(report_path),
    }, ensure_ascii=False))

    return 0 if not report["failed"] else 1


if __name__ == "__main__":
    sys.exit(main())