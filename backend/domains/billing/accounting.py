"""Accounting summaries: purchases, expenses, payments."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from backend.domains.billing.petty_cash import category_label, round_money


def _parse_date(value: Optional[str], *, end_of_day: bool = False) -> Optional[datetime]:
    if not value:
        return None
    raw = str(value).strip()
    try:
        if len(raw) == 10:
            dt = datetime.fromisoformat(raw)
            if end_of_day:
                return dt.replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
            return dt.replace(tzinfo=timezone.utc)
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed
    except ValueError:
        return None


def _in_range(iso_value: Any, start: Optional[datetime], end: Optional[datetime]) -> bool:
    if not iso_value:
        return False
    try:
        dt = datetime.fromisoformat(str(iso_value).replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
    except ValueError:
        return False
    if start and dt < start:
        return False
    if end and dt > end:
        return False
    return True


async def build_accounting_summary(
    db,
    *,
    branch_id: Optional[str],
    start_date: Optional[str],
    end_date: Optional[str],
    fund_snapshot: Dict[str, Any],
) -> Dict[str, Any]:
    start_dt = _parse_date(start_date)
    end_dt = _parse_date(end_date, end_of_day=True)

    sales_query: Dict[str, Any] = {"status": {"$ne": "cancelled"}}
    if branch_id:
        sales_query["branch_id"] = branch_id
    sales = await db.sales.find(sales_query, {"_id": 0}).to_list(5000)

    credit_sales = [
        sale for sale in sales
        if str(sale.get("payment_type") or "").lower() == "credit"
        or str(sale.get("payment_method") or "").lower() == "credit"
    ]
    credit_pending = round_money(sum(round_money(s.get("amount_pending")) for s in credit_sales))

    payments_query: Dict[str, Any] = {}
    if branch_id:
        payments_query["branch_id"] = branch_id
    credit_payments = await db.credit_payments.find(payments_query, {"_id": 0}).to_list(5000)
    invoice_payments = await db.invoice_payments.find(payments_query, {"_id": 0}).to_list(5000)

    filtered_credit_payments = [
        row for row in credit_payments if _in_range(row.get("created_at"), start_dt, end_dt)
    ]
    filtered_invoice_payments = [
        row for row in invoice_payments if _in_range(row.get("created_at"), start_dt, end_dt)
    ]
    payments_total = round_money(
        sum(round_money(row.get("amount")) for row in filtered_credit_payments)
        + sum(round_money(row.get("amount")) for row in filtered_invoice_payments)
    )

    expense_query: Dict[str, Any] = {"status": "paid"}
    if branch_id:
        expense_query["branch_id"] = branch_id
    petty_expenses = await db.petty_cash_expenses.find(expense_query, {"_id": 0}).to_list(5000)
    filtered_petty = [
        row for row in petty_expenses if _in_range(row.get("paid_at") or row.get("created_at"), start_dt, end_dt)
    ]
    petty_total = round_money(sum(round_money(row.get("amount")) for row in filtered_petty))

    caja_query: Dict[str, Any] = {"status": "active"}
    if branch_id:
        caja_query["branch_id"] = branch_id
    caja_expenses = await db.caja_egresos.find(caja_query, {"_id": 0}).to_list(5000)
    filtered_caja = [
        row for row in caja_expenses if _in_range(row.get("created_at"), start_dt, end_dt)
    ]
    caja_total = round_money(sum(round_money(row.get("monto")) for row in filtered_caja))

    sales_in_range = [sale for sale in sales if _in_range(sale.get("created_at"), start_dt, end_dt)]
    sales_total = round_money(sum(round_money(s.get("total")) for s in sales_in_range))
    sales_paid = round_money(
        sum(round_money(s.get("amount_paid")) for s in sales_in_range if str(s.get("payment_status")).lower() == "paid")
    )

    return {
        "branch_id": branch_id,
        "start_date": start_date,
        "end_date": end_date,
        "sales_total": sales_total,
        "sales_paid": sales_paid,
        "credit_pending_total": credit_pending,
        "credit_accounts": len([s for s in credit_sales if round_money(s.get("amount_pending")) > 0]),
        "payments_total": payments_total,
        "payments_count": len(filtered_credit_payments) + len(filtered_invoice_payments),
        "petty_cash_spent": petty_total,
        "petty_cash_expenses_count": len(filtered_petty),
        "cash_session_expenses": caja_total,
        "cash_session_expenses_count": len(filtered_caja),
        "purchases_expenses_total": round_money(petty_total + caja_total),
        "petty_cash_balance": round_money(fund_snapshot.get("balance")),
        "petty_cash_low_balance_alert": bool(fund_snapshot.get("low_balance_alert")),
        "petty_cash_monthly_cap_alert": bool(fund_snapshot.get("monthly_cap_alert")),
    }


async def build_reconciliation_report(
    db,
    *,
    branch_id: str,
    week_start: Optional[str],
    fund_snapshot: Dict[str, Any],
    settings: Dict[str, Any],
) -> Dict[str, Any]:
    if week_start:
        start_dt = _parse_date(week_start) or datetime.now(timezone.utc)
    else:
        now = datetime.now(timezone.utc)
        start_dt = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    end_dt = start_dt + timedelta(days=6, hours=23, minutes=59, seconds=59)

    expenses = await db.petty_cash_expenses.find(
        {"branch_id": branch_id, "status": "paid"},
        {"_id": 0},
    ).to_list(5000)
    week_expenses = [
        row for row in expenses if _in_range(row.get("paid_at") or row.get("created_at"), start_dt, end_dt)
    ]
    replenishments = await db.petty_cash_replenishments.find(
        {"branch_id": branch_id, "status": "active"},
        {"_id": 0},
    ).to_list(5000)
    week_replenishments = [
        row for row in replenishments if _in_range(row.get("created_at"), start_dt, end_dt)
    ]

    spent_week = round_money(sum(round_money(row.get("amount")) for row in week_expenses))
    replenished_week = round_money(sum(round_money(row.get("amount")) for row in week_replenishments))
    opening_balance = round_money(fund_snapshot.get("balance")) + spent_week - replenished_week

    by_category: Dict[str, float] = {}
    for row in week_expenses:
        key = category_label(row.get("category"))
        by_category[key] = round_money(by_category.get(key, 0.0) + round_money(row.get("amount")))

    return {
        "branch_id": branch_id,
        "week_start": start_dt.date().isoformat(),
        "week_end": end_dt.date().isoformat(),
        "opening_balance": opening_balance,
        "expenses_total": spent_week,
        "replenishments_total": replenished_week,
        "closing_balance": round_money(fund_snapshot.get("balance")),
        "expenses": week_expenses,
        "replenishments": week_replenishments,
        "by_category": [
            {"category": key, "amount": amount}
            for key, amount in sorted(by_category.items(), key=lambda item: item[1], reverse=True)
        ],
        "currency": settings.get("currency", "NIO"),
    }


async def list_purchases_and_expenses(
    db,
    *,
    branch_id: Optional[str],
    start_date: Optional[str],
    end_date: Optional[str],
) -> List[Dict[str, Any]]:
    start_dt = _parse_date(start_date)
    end_dt = _parse_date(end_date, end_of_day=True)
    rows: List[Dict[str, Any]] = []

    petty_query: Dict[str, Any] = {"status": {"$in": ["approved", "paid", "pending_approval"]}}
    if branch_id:
        petty_query["branch_id"] = branch_id
    petty_rows = await db.petty_cash_expenses.find(petty_query, {"_id": 0}).to_list(5000)
    for row in petty_rows:
        if not _in_range(row.get("paid_at") or row.get("created_at"), start_dt, end_dt):
            continue
        rows.append({
            "source": "petty_cash",
            "id": row.get("expense_id"),
            "date": row.get("paid_at") or row.get("created_at"),
            "branch_id": row.get("branch_id"),
            "category": category_label(row.get("category")),
            "description": row.get("description"),
            "beneficiary": row.get("beneficiary"),
            "amount": round_money(row.get("amount")),
            "currency": row.get("currency"),
            "status": row.get("status"),
            "voucher_number": row.get("voucher_number"),
        })

    caja_query: Dict[str, Any] = {"status": "active"}
    if branch_id:
        caja_query["branch_id"] = branch_id
    caja_rows = await db.caja_egresos.find(caja_query, {"_id": 0}).to_list(5000)
    for row in caja_rows:
        if not _in_range(row.get("created_at"), start_dt, end_dt):
            continue
        rows.append({
            "source": "cash_session",
            "id": row.get("expense_id"),
            "date": row.get("created_at"),
            "branch_id": row.get("branch_id"),
            "category": "Egreso de caja",
            "description": row.get("concepto"),
            "beneficiary": row.get("beneficiario"),
            "amount": round_money(row.get("monto")),
            "currency": row.get("moneda"),
            "status": row.get("status"),
            "voucher_number": row.get("numero_vale"),
        })

    rows.sort(key=lambda item: str(item.get("date") or ""), reverse=True)
    return rows


async def list_payment_flow(
    db,
    *,
    branch_id: Optional[str],
    start_date: Optional[str],
    end_date: Optional[str],
) -> List[Dict[str, Any]]:
    start_dt = _parse_date(start_date)
    end_dt = _parse_date(end_date, end_of_day=True)
    rows: List[Dict[str, Any]] = []

    credit_query: Dict[str, Any] = {}
    if branch_id:
        credit_query["branch_id"] = branch_id
    credit_rows = await db.credit_payments.find(credit_query, {"_id": 0}).to_list(5000)
    for row in credit_rows:
        if not _in_range(row.get("created_at"), start_dt, end_dt):
            continue
        rows.append({
            "source": "credit_payment",
            "id": row.get("payment_id"),
            "date": row.get("created_at"),
            "branch_id": row.get("branch_id"),
            "reference": row.get("sale_id"),
            "description": row.get("notes") or "Abono a crédito",
            "amount": round_money(row.get("amount")),
            "currency": row.get("currency") or "NIO",
            "payment_method": row.get("payment_method"),
        })

    invoice_query: Dict[str, Any] = {}
    if branch_id:
        invoice_query["branch_id"] = branch_id
    invoice_rows = await db.invoice_payments.find(invoice_query, {"_id": 0}).to_list(5000)
    for row in invoice_rows:
        if not _in_range(row.get("created_at"), start_dt, end_dt):
            continue
        rows.append({
            "source": "invoice_payment",
            "id": row.get("payment_id") or row.get("id"),
            "date": row.get("created_at"),
            "branch_id": row.get("branch_id"),
            "reference": row.get("sale_id") or row.get("invoice_number"),
            "description": row.get("notes") or "Cobro en caja",
            "amount": round_money(row.get("amount")),
            "currency": row.get("currency") or "NIO",
            "payment_method": row.get("payment_method"),
        })

    rows.sort(key=lambda item: str(item.get("date") or ""), reverse=True)
    return rows