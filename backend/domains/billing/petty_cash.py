"""Petty cash expenses, fund balance, approval workflow."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from backend.domains.billing.petty_cash_settings import normalize_petty_cash_settings
from backend.domains.export.pdf_document_settings import PETTY_CASH_CATEGORY_LABELS

EXPENSE_STATUSES = ("draft", "pending_approval", "approved", "paid", "rejected", "voided")
APPROVAL_STATUSES = {"pending_approval"}
PAYABLE_STATUSES = {"approved"}
ACTIVE_EXPENSE_STATUSES = {"draft", "pending_approval", "approved", "paid"}


def round_money(value: Any) -> float:
    try:
        return round(float(value or 0), 2)
    except (TypeError, ValueError):
        return 0.0


def category_label(category: Any) -> str:
    key = str(category or "otros").strip().lower()
    return PETTY_CASH_CATEGORY_LABELS.get(key, key.replace("_", " ").title())


def next_voucher_number(*, prefix: str, existing_numbers: List[str], now: datetime | None = None) -> str:
    current = now or datetime.now(timezone.utc)
    date_part = current.strftime("%Y%m%d")
    base = f"{str(prefix or 'CC').strip().upper()}-{date_part}"
    max_seq = 0
    for raw in existing_numbers:
        text = str(raw or "")
        if not text.startswith(base):
            continue
        suffix = text.rsplit("-", 1)[-1]
        if suffix.isdigit():
            max_seq = max(max_seq, int(suffix))
    return f"{base}-{max_seq + 1:04d}"


def requires_approval(amount: float, settings: Dict[str, Any]) -> bool:
    threshold = round_money(settings.get("requires_approval_above"))
    return round_money(amount) > threshold


def initial_expense_status(amount: float, settings: Dict[str, Any]) -> str:
    return "pending_approval" if requires_approval(amount, settings) else "approved"


async def compute_fund_snapshot(
    db,
    *,
    branch_id: str,
    settings: Dict[str, Any],
    as_of: datetime | None = None,
) -> Dict[str, Any]:
    now = as_of or datetime.now(timezone.utc)
    normalized = normalize_petty_cash_settings(settings)
    currency = normalized["currency"]
    fund_amount = round_money(normalized["fund_amount"])

    replenishments = await db.petty_cash_replenishments.find(
        {"branch_id": branch_id, "status": "active"},
        {"_id": 0, "amount": 1},
    ).to_list(5000)
    replenished = round_money(sum(round_money(row.get("amount")) for row in replenishments))

    paid_expenses = await db.petty_cash_expenses.find(
        {"branch_id": branch_id, "status": "paid"},
        {"_id": 0, "amount": 1, "paid_at": 1, "created_at": 1},
    ).to_list(10000)
    spent_total = round_money(sum(round_money(row.get("amount")) for row in paid_expenses))

    month_prefix = now.strftime("%Y-%m")
    spent_month = round_money(
        sum(
            round_money(row.get("amount"))
            for row in paid_expenses
            if str(row.get("paid_at") or row.get("created_at") or "").startswith(month_prefix)
        )
    )

    balance = round_money(fund_amount + replenished - spent_total)
    threshold_amount = round_money(fund_amount * (float(normalized["low_balance_threshold_pct"]) / 100.0))
    monthly_cap = round_money(normalized["monthly_cap"])
    low_balance = fund_amount > 0 and balance <= threshold_amount
    monthly_cap_exceeded = monthly_cap > 0 and spent_month >= monthly_cap

    return {
        "branch_id": branch_id,
        "currency": currency,
        "fund_amount": fund_amount,
        "replenished_total": replenished,
        "spent_total": spent_total,
        "spent_month": spent_month,
        "balance": balance,
        "monthly_cap": monthly_cap,
        "monthly_cap_remaining": round_money(max(monthly_cap - spent_month, 0.0)) if monthly_cap > 0 else None,
        "low_balance_threshold_amount": threshold_amount,
        "low_balance_alert": low_balance,
        "monthly_cap_alert": monthly_cap_exceeded,
        "requires_approval_above": round_money(normalized["requires_approval_above"]),
    }


def validate_expense_payload(
    payload: Dict[str, Any],
    *,
    settings: Dict[str, Any],
    fund_snapshot: Dict[str, Any],
    for_payment: bool = False,
) -> Tuple[Dict[str, Any], List[str]]:
    errors: List[str] = []
    normalized_settings = normalize_petty_cash_settings(settings)
    amount = round_money(payload.get("amount"))
    if amount <= 0:
        errors.append("El monto debe ser mayor a cero")

    category = str(payload.get("category") or "otros").strip().lower()
    if category not in normalized_settings["allowed_categories"]:
        errors.append("Categoría no permitida para esta sucursal")

    currency = str(payload.get("currency") or normalized_settings["currency"]).strip().upper()
    if currency != normalized_settings["currency"]:
        errors.append(f"La caja chica opera en {normalized_settings['currency']}")

    beneficiary = str(payload.get("beneficiary") or "").strip()
    description = str(payload.get("description") or payload.get("concept") or "").strip()
    if not beneficiary:
        errors.append("Beneficiario requerido")
    if not description:
        errors.append("Concepto requerido")

    if for_payment and amount > round_money(fund_snapshot.get("balance")):
        errors.append("Saldo insuficiente en caja chica")

    monthly_cap = round_money(fund_snapshot.get("monthly_cap"))
    spent_month = round_money(fund_snapshot.get("spent_month"))
    if for_payment and monthly_cap > 0 and spent_month + amount > monthly_cap:
        errors.append("El gasto supera el tope mensual de caja chica")

    employee_user_id = str(payload.get("employee_user_id") or "").strip() or None
    clean = {
        "amount": amount,
        "currency": currency,
        "category": category,
        "description": description,
        "beneficiary": beneficiary,
        "employee_user_id": employee_user_id,
        "payment_method": str(payload.get("payment_method") or "cash").strip().lower() or "cash",
        "received_by": str(payload.get("received_by") or beneficiary).strip(),
        "notes": str(payload.get("notes") or "").strip(),
        "session_id": str(payload.get("session_id") or "").strip() or None,
    }
    return clean, errors


def serialize_expense_for_pdf(expense: Dict[str, Any], *, branch_name: str = "") -> Dict[str, Any]:
    return {
        "voucher_number": expense.get("voucher_number") or expense.get("expense_id"),
        "created_at": expense.get("paid_at") or expense.get("created_at"),
        "branch_name": branch_name or expense.get("branch_name") or expense.get("branch_id"),
        "beneficiary": expense.get("beneficiary"),
        "category": expense.get("category"),
        "description": expense.get("description"),
        "amount": expense.get("amount"),
        "currency": expense.get("currency"),
        "payment_method": expense.get("payment_method"),
        "authorized_by": expense.get("authorized_by_name") or expense.get("approved_by_name"),
        "received_by": expense.get("received_by") or expense.get("beneficiary"),
        "notes": expense.get("notes"),
    }