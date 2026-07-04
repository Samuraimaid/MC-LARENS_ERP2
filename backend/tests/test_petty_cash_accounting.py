"""Petty cash workflow and accounting helpers."""

from __future__ import annotations

from backend.domains.billing.petty_cash import (
    initial_expense_status,
    next_voucher_number,
    requires_approval,
    validate_expense_payload,
)
from backend.domains.billing.petty_cash_settings import (
    merge_petty_cash_settings,
    normalize_petty_cash_settings,
)


def test_normalize_petty_cash_settings_defaults():
    settings = normalize_petty_cash_settings(None)
    assert settings["fund_amount"] == 5000.0
    assert settings["requires_approval_above"] == 500.0
    assert "viaticos" in settings["allowed_categories"]


def test_requires_approval_threshold():
    settings = normalize_petty_cash_settings({"requires_approval_above": 300})
    assert requires_approval(301, settings) is True
    assert requires_approval(300, settings) is False
    assert initial_expense_status(301, settings) == "pending_approval"
    assert initial_expense_status(100, settings) == "approved"


def test_next_voucher_number_increments_daily_sequence():
    first = next_voucher_number(prefix="CC", existing_numbers=[])
    second = next_voucher_number(prefix="CC", existing_numbers=[first])
    assert first.startswith("CC-")
    assert first != second
    assert first.rsplit("-", 1)[-1] == "0001"
    assert second.rsplit("-", 1)[-1] == "0002"


def test_validate_expense_payload_requires_beneficiary_and_description():
    settings = normalize_petty_cash_settings({})
    snapshot = {"balance": 1000, "monthly_cap": 5000, "spent_month": 0}
    clean, errors = validate_expense_payload(
        {"amount": 100, "beneficiary": "", "description": ""},
        settings=settings,
        fund_snapshot=snapshot,
    )
    assert clean["amount"] == 100.0
    assert "Beneficiario requerido" in errors
    assert "Concepto requerido" in errors


def test_merge_petty_cash_settings_updates_fund_amount():
    merged = merge_petty_cash_settings(
        normalize_petty_cash_settings({}),
        {"fund_amount": 7500, "monthly_cap": 20000},
    )
    assert merged["fund_amount"] == 7500.0
    assert merged["monthly_cap"] == 20000.0