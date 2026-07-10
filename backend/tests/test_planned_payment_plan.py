"""Planned payment plan validation tests."""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from backend.domains.sales.planned_payment_plan import (
    normalize_planned_payment_plan,
    validate_collect_against_plan,
)


class TestPlannedPaymentPlanRules:
    def test_rejects_plan_total_mismatch_beyond_tolerance(self):
        with pytest.raises(HTTPException) as exc:
            normalize_planned_payment_plan(
                {
                    "mode": "cash",
                    "lines": [{"metodo": "cash", "moneda": "NIO", "monto_origen": 1000}],
                },
                payment_method="cash",
                mixed_methods=[],
                net_to_collect=1500,
                exchange_rate=36.5,
                currency="NIO",
            )
        assert exc.value.status_code == 409
        assert exc.value.detail["error"] == "PAYMENT_PLAN_MISMATCH"

    def test_accepts_plan_within_rounding_tolerance_and_adjusts_last_line(self):
        plan = normalize_planned_payment_plan(
            {
                "mode": "mixed",
                "lines": [
                    {"metodo": "cash", "moneda": "NIO", "monto_origen": 3793.27},
                    {"metodo": "transfer", "moneda": "NIO", "monto_origen": 2528.84},
                ],
            },
            payment_method="mixed",
            mixed_methods=["cash", "transfer"],
            net_to_collect=6322.12,
            exchange_rate=36.5,
            currency="NIO",
        )
        assert plan["planned_total_nio"] == 6322.12
        assert plan["lines"][-1]["monto_origen"] == 2528.85
        assert plan["lines"][-1]["monto_cordobas"] == 2528.85

    def test_accepts_exact_mixed_plan(self):
        plan = normalize_planned_payment_plan(
            {
                "mode": "mixed",
                "lines": [
                    {"metodo": "cash", "moneda": "USD", "monto_origen": 200},
                    {"metodo": "card", "moneda": "NIO", "monto_origen": 7700},
                ],
            },
            payment_method="mixed",
            mixed_methods=["cash", "card"],
            net_to_collect=15000,
            exchange_rate=36.5,
            currency="NIO",
        )
        assert plan["planned_total_nio"] == 15000
        assert len(plan["lines"]) == 2

    def test_collect_must_match_locked_plan(self):
        plan = {
            "locked": True,
            "mode": "mixed",
            "lines": [
                {"metodo": "cash", "moneda": "NIO", "monto_origen": 1000},
                {"metodo": "card", "moneda": "NIO", "monto_origen": 500},
            ],
        }
        with pytest.raises(HTTPException) as exc:
            validate_collect_against_plan(
                plan,
                pagos=[
                    {"metodo": "cash", "moneda": "NIO", "monto_origen": 1000},
                    {"metodo": "card", "moneda": "NIO", "monto_origen": 400},
                ],
            )
        assert exc.value.status_code == 409

    def test_accepts_mixed_usd_plan_within_two_decimal_tolerance(self):
        plan = normalize_planned_payment_plan(
            {
                "mode": "mixed",
                "lines": [
                    {"metodo": "cash", "moneda": "USD", "monto_origen": 100},
                    {"metodo": "transfer", "moneda": "USD", "monto_origen": 73.21},
                ],
            },
            payment_method="mixed",
            mixed_methods=["cash", "transfer"],
            net_to_collect=6322.12,
            exchange_rate=36.5,
            currency="NIO",
        )
        assert plan["planned_total_nio"] == 6322.12
        assert plan["lines"][0]["monto_origen"] == 100.0
        assert plan["lines"][1]["monto_origen"] == 73.21
        assert plan["lines"][1]["monto_cordobas"] == 2672.12

    def test_collect_allows_simple_amount_within_tolerance(self):
        plan = {
            "locked": True,
            "mode": "cash",
            "exchange_rate": 36.5,
            "lines": [
                {"metodo": "cash", "moneda": "NIO", "monto_origen": 6322.12, "monto_cordobas": 6322.12},
            ],
        }
        validate_collect_against_plan(plan, amount=6322.11, payment_method="cash")

    def test_collect_rejects_simple_amount_beyond_tolerance(self):
        plan = {
            "locked": True,
            "mode": "cash",
            "lines": [
                {"metodo": "cash", "moneda": "NIO", "monto_origen": 6322.12, "monto_cordobas": 6322.12},
            ],
        }
        with pytest.raises(HTTPException) as exc:
            validate_collect_against_plan(plan, amount=6322.10, payment_method="cash")
        assert exc.value.status_code == 409

    def test_collect_allows_partial_simple_when_method_matches(self):
        plan = {
            "locked": True,
            "mode": "cash",
            "exchange_rate": 36.5,
            "lines": [
                {"metodo": "cash", "moneda": "NIO", "monto_origen": 1000, "monto_cordobas": 1000},
            ],
        }
        validate_collect_against_plan(
            plan,
            amount=400,
            payment_method="cash",
            pending_amount=1000,
        )

    def test_collect_rejects_partial_simple_wrong_method(self):
        plan = {
            "locked": True,
            "mode": "cash",
            "lines": [
                {"metodo": "cash", "moneda": "NIO", "monto_origen": 1000, "monto_cordobas": 1000},
            ],
        }
        with pytest.raises(HTTPException) as exc:
            validate_collect_against_plan(
                plan,
                amount=400,
                payment_method="transfer",
                pending_amount=1000,
            )
        assert exc.value.status_code == 409

    def test_mixed_cash_collect_allows_cross_currency_when_nio_total_matches(self):
        plan = {
            "locked": True,
            "mode": "cash",
            "exchange_rate": 36.62,
            "lines": [
                {"metodo": "cash", "moneda": "NIO", "monto_origen": 12700, "monto_cordobas": 12700},
                {"metodo": "cash", "moneda": "USD", "monto_origen": 200, "monto_cordobas": 7324.0},
            ],
        }
        validate_collect_against_plan(
            plan,
            pagos=[{"metodo": "cash", "moneda": "NIO", "monto_origen": 20024}],
            amount=20024,
            payment_method="cash",
            pending_amount=20024,
        )

    def test_mixed_collect_always_requires_exact_signature_even_if_under_pending(self):
        plan = {
            "locked": True,
            "mode": "mixed",
            "lines": [
                {"metodo": "cash", "moneda": "NIO", "monto_origen": 1000},
                {"metodo": "card", "moneda": "NIO", "monto_origen": 500},
            ],
        }
        with pytest.raises(HTTPException) as exc:
            validate_collect_against_plan(
                plan,
                pagos=[
                    {"metodo": "cash", "moneda": "NIO", "monto_origen": 1000},
                    {"metodo": "card", "moneda": "NIO", "monto_origen": 490},
                ],
                amount=1490,
                payment_method="mixed",
                pending_amount=1500,
            )
        assert exc.value.status_code == 409

    def test_collect_allows_card_override_after_pos_discount_approval(self):
        plan = {
            "locked": True,
            "mode": "cash",
            "exchange_rate": 36.5,
            "lines": [
                {"metodo": "cash", "moneda": "NIO", "monto_origen": 1000, "monto_cordobas": 1000},
            ],
        }
        validate_collect_against_plan(
            plan,
            amount=1000,
            payment_method="card",
            pending_amount=1000,
            allow_card_override=True,
        )

    def test_collect_final_payment_validates_remaining_pending(self):
        plan = {
            "locked": True,
            "mode": "cash",
            "exchange_rate": 36.5,
            "lines": [
                {"metodo": "cash", "moneda": "NIO", "monto_origen": 1000, "monto_cordobas": 1000},
            ],
        }
        validate_collect_against_plan(
            plan,
            amount=600,
            payment_method="cash",
            pending_amount=600,
        )
        with pytest.raises(HTTPException) as exc:
            validate_collect_against_plan(
                plan,
                amount=601,
                payment_method="cash",
                pending_amount=600,
            )
        assert exc.value.status_code == 409