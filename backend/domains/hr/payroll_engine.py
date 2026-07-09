"""Payroll computation: base salary, commissions, INSS, bonuses and deductions."""
from __future__ import annotations

import os
import uuid
from datetime import date, datetime, time, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from backend.domains.hr.payroll_periods import (
    format_quincena_label,
    get_branch_payroll_scheme,
    get_period_bounds_for_branch,
    resolve_pay_day_for_period_end,
)
from backend.domains.hr.technician_jobs import collect_technician_completed_jobs

INSS_LABORAL_RATE = 0.07

DEDUCTION_TYPES = frozenset({
    "penalizacion",
    "multa",
    "sancion",
    "descuento_herramienta",
    "tool_missing_deduction",
    "late_arrival_deduction",
    "adelanto_salario",
    "petty_cash_advance",
})


def _round_money(value: Any) -> float:
    return round(float(value or 0.0), 2)


def _parse_bool(value: Any, default: bool = False) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    text = str(value).strip().lower()
    if text in {"1", "true", "yes", "si", "on"}:
        return True
    if text in {"0", "false", "no", "off"}:
        return False
    return default


def normalize_hr_employee_fields(data: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    payload = data or {}
    return {
        "base_salary": max(0.0, _round_money(payload.get("base_salary"))),
        "earns_commissions": _parse_bool(payload.get("earns_commissions"), False),
        "has_social_security": _parse_bool(payload.get("has_social_security"), False),
        "eligible_for_attendance_bonus": _parse_bool(payload.get("eligible_for_attendance_bonus"), False),
    }


def proportional_base_salary(monthly_base: float) -> float:
    return _round_money(max(0.0, monthly_base) / 2.0)


async def compute_workshop_commissions(
    db: Any,
    user_doc: Dict[str, Any],
    period_start: date,
    period_end: date,
) -> Tuple[float, int, int, float]:
    """
    Comisiones por OT/taller completadas (work_orders QC-approved + tint_orders).
    Retorna (monto, jobs_count, linked_sales_count, linked_sales_total).
    """
    user_id = str(user_doc.get("user_id") or "")
    user_role = str(user_doc.get("role") or "")
    branch_id = str(user_doc.get("branch_id") or "") or None

    jobs = await collect_technician_completed_jobs(
        db,
        user_id=user_id,
        user_role=user_role,
        branch_id=branch_id,
        period_start=period_start,
        period_end=period_end,
    )
    per_job_amount = float(os.environ.get("HR_TECH_COMMISSION_PER_JOB", "150"))
    sale_rate = float(os.environ.get("HR_TECH_COMMISSION_SALE_RATE", os.environ.get("HR_DEFAULT_COMMISSION_RATE", "0.03")))

    job_commission = _round_money(len(jobs) * max(0.0, per_job_amount))

    sale_ids = sorted(
        {
            str(job.get("sale_id")).strip()
            for job in jobs
            if str(job.get("sale_id") or "").strip()
        }
    )
    linked_sales_total = 0.0
    if sale_ids:
        start_iso = datetime.combine(period_start, time.min, tzinfo=timezone.utc).isoformat()
        end_iso = datetime.combine(period_end + timedelta(days=1), time.min, tzinfo=timezone.utc).isoformat()
        sales = await db.sales.find(
            {
                "sale_id": {"$in": sale_ids},
                "created_at": {"$gte": start_iso, "$lt": end_iso},
                "status": {"$nin": ["cancelled", "void", "anulada", "canceled"]},
            },
            {"_id": 0, "sale_id": 1, "total": 1},
        ).to_list(5000)
        linked_sales_total = _round_money(sum(float(item.get("total") or 0) for item in sales))

    sale_commission = _round_money(linked_sales_total * sale_rate)
    total = _round_money(job_commission + sale_commission)
    return total, len(jobs), len(sale_ids), linked_sales_total


async def compute_sales_commissions(
    db: Any,
    user_id: str,
    period_start: date,
    period_end: date,
) -> Tuple[float, float, int]:
    rate = float(os.environ.get("HR_DEFAULT_COMMISSION_RATE", "0.03"))
    start_iso = datetime.combine(period_start, time.min, tzinfo=timezone.utc).isoformat()
    end_iso = datetime.combine(period_end + timedelta(days=1), time.min, tzinfo=timezone.utc).isoformat()
    sales = await db.sales.find(
        {
            "$or": [
                {"salesperson_id": user_id},
                {"seller_id": user_id},
                {"created_by": user_id},
            ],
            "created_at": {"$gte": start_iso, "$lt": end_iso},
            "status": {"$nin": ["cancelled", "void", "anulada", "canceled"]},
        },
        {"_id": 0, "total": 1},
    ).to_list(5000)
    total_sales = _round_money(sum(float(item.get("total") or 0) for item in sales))
    return _round_money(total_sales * rate), total_sales, len(sales)


async def fetch_payroll_adjustments(
    db: Any,
    user_id: str,
    period_start: date,
    period_end: date,
) -> List[Dict[str, Any]]:
    start_key = period_start.isoformat()
    end_key = period_end.isoformat()
    docs = await db.hr_payroll_adjustments.find(
        {"user_id": user_id},
        {"_id": 0},
    ).sort("created_at", 1).to_list(1000)
    filtered: List[Dict[str, Any]] = []
    for doc in docs:
        effective = str(doc.get("effective_date") or doc.get("created_at") or "")[:10]
        if not effective:
            continue
        if start_key <= effective <= end_key:
            filtered.append(doc)
    return filtered


async def fetch_petty_cash_advances(
    db: Any,
    user_doc: Dict[str, Any],
    period_start: date,
    period_end: date,
) -> List[Dict[str, Any]]:
    user_id = str(user_doc.get("user_id") or "")
    full_name = " ".join(
        part for part in [user_doc.get("name"), user_doc.get("last_name")] if part
    ).strip()
    start_iso = datetime.combine(period_start, time.min, tzinfo=timezone.utc).isoformat()
    end_iso = datetime.combine(period_end + timedelta(days=1), time.min, tzinfo=timezone.utc).isoformat()
    query: Dict[str, Any] = {
        "category": "adelanto_salario",
        "status": "paid",
        "$or": [
            {"employee_user_id": user_id},
        ],
    }
    if full_name:
        query["$or"].append({"beneficiary": full_name})
    rows = await db.petty_cash_expenses.find(query, {"_id": 0}).to_list(500)
    filtered: List[Dict[str, Any]] = []
    for row in rows:
        stamp = str(row.get("paid_at") or row.get("created_at") or "")
        if stamp and start_iso <= stamp < end_iso:
            filtered.append(row)
    return filtered


def classify_compliance(absences: int, late_minutes: int, lunch_over_minutes: int) -> str:
    if absences >= 2 or late_minutes > 60 or lunch_over_minutes > 60:
        return "rojo"
    if absences >= 1 or late_minutes > 15 or lunch_over_minutes > 20:
        return "amarillo"
    return "verde"


async def compute_attendance_compliance(
    db: Any,
    *,
    user_id: str,
    period_start: date,
    period_end: date,
    attendance_metrics_fn: Any,
) -> Dict[str, Any]:
    metrics = await attendance_metrics_fn(
        db=db,
        user_id=user_id,
        period_start=period_start,
        period_end=period_end,
    )
    status = classify_compliance(
        int(metrics.get("absences") or 0),
        int(metrics.get("late_minutes") or 0),
        int(metrics.get("lunch_over_minutes") or 0),
    )
    return {**metrics, "compliance_status": status}


async def build_payroll_snapshot(
    db: Any,
    user_doc: Dict[str, Any],
    *,
    period_start: date,
    period_end: date,
    attendance_metrics_fn: Any,
    branch_name: str = "",
) -> Dict[str, Any]:
    user_id = str(user_doc.get("user_id") or "")
    branch_id = str(user_doc.get("branch_id") or "")
    hr_fields = normalize_hr_employee_fields(user_doc)
    monthly_base = float(hr_fields["base_salary"])
    base_salary = proportional_base_salary(monthly_base)

    commissions = 0.0
    commission_sales_total = 0.0
    commission_sales_count = 0
    workshop_commissions = 0.0
    workshop_jobs_count = 0
    workshop_linked_sales_total = 0.0
    if hr_fields["earns_commissions"]:
        sales_amount, commission_sales_total, commission_sales_count = await compute_sales_commissions(
            db, user_id, period_start, period_end
        )
        workshop_commissions, workshop_jobs_count, _, workshop_linked_sales_total = await compute_workshop_commissions(
            db, user_doc, period_start, period_end
        )
        commissions = _round_money(sales_amount + workshop_commissions)

    attendance = await compute_attendance_compliance(
        db,
        user_id=user_id,
        period_start=period_start,
        period_end=period_end,
        attendance_metrics_fn=attendance_metrics_fn,
    )
    attendance_bonus = 0.0
    bonus_amount = float(os.environ.get("HR_ATTENDANCE_BONUS_AMOUNT", "500"))
    if hr_fields["eligible_for_attendance_bonus"] and attendance.get("compliance_status") == "verde":
        attendance_bonus = _round_money(bonus_amount)

    gross_earnings = _round_money(base_salary + commissions + attendance_bonus)

    adjustment_rows = await fetch_payroll_adjustments(db, user_id, period_start, period_end)
    petty_advances = await fetch_petty_cash_advances(db, user_doc, period_start, period_end)

    deductions_breakdown: List[Dict[str, Any]] = []
    total_deductions = 0.0

    for row in adjustment_rows:
        amount = float(row.get("amount") or 0)
        if amount >= 0:
            continue
        deduction_amount = _round_money(abs(amount))
        total_deductions += deduction_amount
        deductions_breakdown.append(
            {
                "type": row.get("adjustment_type"),
                "label": row.get("adjustment_type"),
                "amount": deduction_amount,
                "reference_id": row.get("reference_id"),
                "notes": row.get("notes"),
                "source": "hr_payroll_adjustment",
            }
        )

    for row in petty_advances:
        deduction_amount = _round_money(row.get("amount"))
        if deduction_amount <= 0:
            continue
        total_deductions += deduction_amount
        deductions_breakdown.append(
            {
                "type": "adelanto_salario",
                "label": "Adelanto de caja chica",
                "amount": deduction_amount,
                "reference_id": row.get("expense_id"),
                "notes": row.get("description"),
                "source": "petty_cash",
            }
        )

    inss_amount = 0.0
    if hr_fields["has_social_security"] and gross_earnings > 0:
        inss_amount = _round_money(gross_earnings * INSS_LABORAL_RATE)
        deductions_breakdown.append(
            {
                "type": "inss_laboral",
                "label": "INSS Laboral (7%)",
                "amount": inss_amount,
                "reference_id": None,
                "notes": f"7% sobre ingresos brutos C$ {gross_earnings:.2f}",
                "source": "statutory",
            }
        )

    total_deductions = _round_money(total_deductions + inss_amount)
    net_pay = _round_money(max(0.0, gross_earnings - total_deductions))

    pay_day = resolve_pay_day_for_period_end(period_end, branch_id)
    scheme = get_branch_payroll_scheme(branch_id)

    return {
        "stub_id": f"ps_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "user_name": " ".join(
            part for part in [user_doc.get("name"), user_doc.get("last_name")] if part
        ).strip() or user_doc.get("name"),
        "branch_id": branch_id,
        "branch_name": branch_name or branch_id,
        "period_start": period_start.isoformat(),
        "period_end": period_end.isoformat(),
        "period_label": format_quincena_label(period_start, period_end),
        "pay_date": pay_day.isoformat(),
        "payroll_scheme": scheme,
        "base_salary_monthly": monthly_base,
        "base_salary_proportional": base_salary,
        "commissions": commissions,
        "commission_sales_total": commission_sales_total,
        "commission_sales_count": commission_sales_count,
        "workshop_commissions": workshop_commissions,
        "workshop_jobs_count": workshop_jobs_count,
        "workshop_linked_sales_total": workshop_linked_sales_total,
        "earns_commissions": hr_fields["earns_commissions"],
        "attendance_bonus": attendance_bonus,
        "eligible_for_attendance_bonus": hr_fields["eligible_for_attendance_bonus"],
        "attendance_compliance": attendance.get("compliance_status"),
        "attendance_metrics": attendance,
        "has_social_security": hr_fields["has_social_security"],
        "inss_rate": INSS_LABORAL_RATE,
        "inss_amount": inss_amount,
        "gross_earnings": gross_earnings,
        "deductions_breakdown": deductions_breakdown,
        "total_deductions": total_deductions,
        "net_pay": net_pay,
        "currency": "NIO",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


def resolve_processing_period(
    user_doc: Dict[str, Any],
    *,
    reference_date: Optional[date] = None,
    period_start: Optional[date] = None,
    period_end: Optional[date] = None,
    offset: int = 0,
) -> Tuple[date, date]:
    if period_start and period_end:
        return period_start, period_end
    branch_id = str(user_doc.get("branch_id") or "")
    ref = reference_date or date.today()
    return get_period_bounds_for_branch(branch_id, ref, offset=offset)