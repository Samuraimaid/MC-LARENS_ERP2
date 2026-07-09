"""Live E2E HR simulation: payroll, INSS, pay stubs, branch isolation."""

from __future__ import annotations

import traceback
import uuid
from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional

import httpx

PIN_GERENCIA = "01011990"
BRANCH_MAIN = "branch_main"
BRANCH_NORTH = "branch_north"
INSS_RATE = 0.07
RUN_TAG = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")


def _round2(value: Any) -> float:
    return round(float(value or 0.0), 2)


class ApiSession:
    def __init__(self, label: str, base_url: str):
        self.label = label
        self.base_url = base_url.rstrip("/")
        self.client = httpx.Client(timeout=120.0, follow_redirects=True)
        self.user: Dict[str, Any] = {}

    def login(self, pin: str, user_id: Optional[str] = None) -> Dict[str, Any]:
        payload: Dict[str, Any] = {"pin": pin}
        if user_id:
            payload["user_id"] = user_id
        response = self.client.post(f"{self.base_url}/auth/pin/login", json=payload)
        response.raise_for_status()
        self.user = response.json().get("user") or {}
        return self.user

    def get(self, path: str, **kwargs) -> httpx.Response:
        return self.client.get(f"{self.base_url}{path}", **kwargs)

    def post(self, path: str, json_body: Any = None, **kwargs) -> httpx.Response:
        return self.client.post(f"{self.base_url}{path}", json=json_body, **kwargs)

    def put(self, path: str, json_body: Any = None, **kwargs) -> httpx.Response:
        return self.client.put(f"{self.base_url}{path}", json=json_body, **kwargs)


def _detail(response: httpx.Response) -> str:
    text = (response.text or "").strip()
    return f"{response.status_code}: {text[:500]}"


def _step(steps: List[Dict[str, Any]], name: str, *, ok: bool, detail: str = "", data: Any = None) -> None:
    steps.append({"name": name, "success": ok, "detail": detail, "data": data})


def _create_pin_user(
    gerencia: ApiSession,
    *,
    name: str,
    branch_id: str,
    role: str,
    base_salary: float,
    earns_commissions: bool,
    has_social_security: bool,
    eligible_for_attendance_bonus: bool,
) -> Dict[str, Any]:
    login_pin = f"{uuid.uuid4().int % 100000000:08d}"
    attendance_pin = f"{uuid.uuid4().int % 10000:04d}"
    payload = {
        "name": name,
        "last_name": "E2EHR",
        "phone": "8888-8888",
        "role": role,
        "branch_id": branch_id,
        "login_pin": login_pin,
        "pin": attendance_pin,
        "base_salary": base_salary,
        "earns_commissions": earns_commissions,
        "has_social_security": has_social_security,
        "eligible_for_attendance_bonus": eligible_for_attendance_bonus,
    }
    response = gerencia.post("/users/pin", json_body=payload)
    if response.status_code != 200:
        raise RuntimeError(f"No se pudo crear usuario HR: {_detail(response)}")
    user = response.json()
    user["_attendance_pin"] = attendance_pin
    user["_login_pin"] = login_pin
    return user


def _insert_sale_for_commission(
    gerencia: ApiSession,
    *,
    seller_id: str,
    branch_id: str,
    total: float,
    created_at: str,
) -> str:
    sale_id = f"sale_hr_{RUN_TAG}_{uuid.uuid4().hex[:6]}"
    now_iso = created_at
    response = gerencia.post(
        "/qa/debug/upsert-document",
        json_body={
            "collection": "sales",
            "document": {
                "sale_id": sale_id,
                "seller_id": seller_id,
                "salesperson_id": seller_id,
                "created_by": seller_id,
                "branch_id": branch_id,
                "total": total,
                "status": "completed",
                "created_at": now_iso,
            },
            "upsert_key": "sale_id",
        },
    )
    if response.status_code not in {200, 201}:
        raise RuntimeError(f"No se pudo insertar venta QA: {_detail(response)}")
    return sale_id


def _insert_completed_work_order(
    gerencia: ApiSession,
    *,
    technician_id: str,
    sale_id: str,
    branch_id: str,
    completed_at: str,
) -> str:
    work_order_id = f"wo_hr_{RUN_TAG}_{uuid.uuid4().hex[:6]}"
    response = gerencia.post(
        "/qa/debug/upsert-document",
        json_body={
            "collection": "work_orders",
            "document": {
                "work_order_id": work_order_id,
                "technician_id": technician_id,
                "sale_id": sale_id,
                "branch_id": branch_id,
                "status": "completed",
                "department": "instalaciones",
                "qc_approved": True,
                "qc_approved_at": completed_at,
                "end_time": completed_at,
            },
            "upsert_key": "work_order_id",
        },
    )
    if response.status_code not in {200, 201}:
        raise RuntimeError(f"No se pudo insertar OT QA: {_detail(response)}")
    return work_order_id


def _insert_late_deduction(
    gerencia: ApiSession,
    *,
    user_id: str,
    effective_date: str,
    amount: float = 50.0,
) -> None:
    today = effective_date
    response = gerencia.post(
        "/hr/payroll-adjustments",
        json_body={
            "user_id": user_id,
            "adjustment_type": "late_arrival_deduction",
            "amount": -abs(amount),
            "effective_date": today,
            "notes": "Deducción tardanza E2E HR",
        },
    )
    if response.status_code != 200:
        raise RuntimeError(f"No se pudo registrar deducción tardanza: {_detail(response)}")


def _process_pay_stub(
    session: ApiSession,
    *,
    user_id: str,
    period_start: str,
    period_end: str,
) -> Dict[str, Any]:
    response = session.post(
        "/hr/pay-stubs",
        json_body={
            "user_id": user_id,
            "period_start": period_start,
            "period_end": period_end,
            "force_reprocess": True,
        },
    )
    if response.status_code != 200:
        raise RuntimeError(f"No se pudo procesar nómina: {_detail(response)}")
    body = response.json()
    return body.get("pay_stub") or {}


def run_hr_simulation_suite(base_url: str) -> Dict[str, Any]:
    steps: List[Dict[str, Any]] = []
    cases: List[Dict[str, Any]] = []
    success = True

    try:
        gerencia = ApiSession("gerencia", base_url)
        gerencia.login(PIN_GERENCIA)
        _step(steps, "login_gerencia", ok=True, detail=gerencia.user.get("user_id"))

        # Caso 1 — Mundo de Accesorios
        tech_main = _create_pin_user(
            gerencia,
            name=f"HR Tech Main {RUN_TAG}",
            branch_id=BRANCH_MAIN,
            role="instalaciones",
            base_salary=20000.0,
            earns_commissions=True,
            has_social_security=True,
            eligible_for_attendance_bonus=True,
        )
        _step(steps, "case1_create_technician_main", ok=True, data={"user_id": tech_main.get("user_id")})

        period_main_start = "2026-06-09"
        period_main_end = "2026-06-24"
        sale_total = 10000.0
        sale_id = _insert_sale_for_commission(
            gerencia,
            seller_id=str(tech_main.get("user_id")),
            branch_id=BRANCH_MAIN,
            total=sale_total,
            created_at="2026-06-20T15:00:00+00:00",
        )
        _insert_completed_work_order(
            gerencia,
            technician_id=str(tech_main.get("user_id")),
            sale_id=sale_id,
            branch_id=BRANCH_MAIN,
            completed_at="2026-06-20T16:00:00+00:00",
        )
        _insert_late_deduction(
            gerencia,
            user_id=str(tech_main.get("user_id")),
            effective_date="2026-06-18",
        )
        _step(steps, "case1_seed_commission_and_late_deduction", ok=True)

        stub_main = _process_pay_stub(
            gerencia,
            user_id=str(tech_main.get("user_id")),
            period_start=period_main_start,
            period_end=period_main_end,
        )
        gross = _round2(stub_main.get("gross_earnings"))
        inss = _round2(stub_main.get("inss_amount"))
        expected_inss = _round2(gross * INSS_RATE)
        commissions = _round2(stub_main.get("commissions"))
        workshop_commissions = _round2(stub_main.get("workshop_commissions"))
        workshop_jobs = int(stub_main.get("workshop_jobs_count") or 0)
        case1_ok = (
            stub_main.get("has_social_security") is True
            and commissions > 0
            and workshop_commissions > 0
            and workshop_jobs >= 1
            and abs(inss - expected_inss) < 0.05
            and inss > 0
        )
        _step(
            steps,
            "case1_process_payroll_main",
            ok=case1_ok,
            detail=(
                f"gross={gross} inss={inss} expected={expected_inss} "
                f"commissions={commissions} workshop={workshop_commissions} jobs={workshop_jobs}"
            ),
            data={"stub_id": stub_main.get("stub_id"), "period": stub_main.get("period_label")},
        )

        pdf_res = gerencia.get(f"/hr/pay-stubs/{stub_main.get('stub_id')}/pdf")
        _step(
            steps,
            "case1_download_pay_stub_pdf",
            ok=pdf_res.status_code == 200 and pdf_res.headers.get("content-type", "").startswith("application/pdf"),
            detail=f"bytes={len(pdf_res.content)}",
        )

        cases.append(
            {
                "case": "mundo_accesorios_inss_commissions",
                "success": case1_ok and pdf_res.status_code == 200,
                "stub_id": stub_main.get("stub_id"),
                "inss_amount": inss,
                "inss_expected": expected_inss,
                "commissions": commissions,
            }
        )

        # Caso 2 — TopCar North
        seller_north = _create_pin_user(
            gerencia,
            name=f"HR Seller North {RUN_TAG}",
            branch_id=BRANCH_NORTH,
            role="ventas",
            base_salary=15000.0,
            earns_commissions=False,
            has_social_security=False,
            eligible_for_attendance_bonus=False,
        )
        _step(steps, "case2_create_seller_north", ok=True, data={"user_id": seller_north.get("user_id")})

        period_north_start = "2026-06-16"
        period_north_end = "2026-06-30"
        _insert_sale_for_commission(
            gerencia,
            seller_id=str(seller_north.get("user_id")),
            branch_id=BRANCH_NORTH,
            total=8000.0,
            created_at="2026-06-25T15:00:00+00:00",
        )

        stub_north = _process_pay_stub(
            gerencia,
            user_id=str(seller_north.get("user_id")),
            period_start=period_north_start,
            period_end=period_north_end,
        )
        case2_ok = (
            _round2(stub_north.get("commissions")) == 0.0
            and _round2(stub_north.get("inss_amount")) == 0.0
            and _round2(stub_north.get("base_salary_proportional")) > 0
        )
        _step(
            steps,
            "case2_process_payroll_north",
            ok=case2_ok,
            detail=(
                f"base={stub_north.get('base_salary_proportional')} "
                f"commissions={stub_north.get('commissions')} inss={stub_north.get('inss_amount')}"
            ),
            data={"stub_id": stub_north.get("stub_id"), "period": stub_north.get("period_label")},
        )
        cases.append(
            {
                "case": "topcar_north_base_only",
                "success": case2_ok,
                "stub_id": stub_north.get("stub_id"),
            }
        )

        # Caso 3 — Supervisor TopCar no ve nómina Mundo
        supervisor_user = _create_pin_user(
            gerencia,
            name=f"HR Sup North {RUN_TAG}",
            branch_id=BRANCH_NORTH,
            role="supervisor",
            base_salary=18000.0,
            earns_commissions=False,
            has_social_security=False,
            eligible_for_attendance_bonus=False,
        )
        supervisor = ApiSession("supervisor_north", base_url)
        supervisor.login(str(supervisor_user.get("_login_pin")), user_id=str(supervisor_user.get("user_id")))
        blocked = supervisor.get(
            "/hr/pay-stubs",
            params={"user_id": str(tech_main.get("user_id"))},
        )
        case3_ok = blocked.status_code == 403
        _step(
            steps,
            "case3_supervisor_branch_isolation",
            ok=case3_ok,
            detail=_detail(blocked),
        )
        cases.append({"case": "supervisor_branch_isolation", "success": case3_ok})

        success = all(item.get("success") for item in cases)
    except Exception as exc:
        success = False
        _step(steps, "fatal_error", ok=False, detail=str(exc))
        traceback.print_exc()

    return {
        "success": success,
        "run_tag": RUN_TAG,
        "steps": steps,
        "cases": cases,
        "completed_at": datetime.now(timezone.utc).isoformat(),
    }