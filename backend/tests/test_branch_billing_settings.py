"""Per-branch billing settings helpers."""

from __future__ import annotations

from backend.domains.billing.branch_settings import (
    DEFAULT_BILLING_BRANCH_ID,
    billing_legacy_settings_query,
    billing_settings_query,
    finalize_billing_settings_doc,
    normalize_billing_branch_id,
    seed_billing_settings_doc,
)
from backend.domains.export.pdf_documents import DEFAULT_PDF_DOCUMENT_SETTINGS, normalize_pdf_document_settings
from backend.domains.sales.voucher_settings import normalize_seller_voucher_settings


def test_normalize_billing_branch_id_defaults_to_main():
    assert normalize_billing_branch_id(None) == DEFAULT_BILLING_BRANCH_ID
    assert normalize_billing_branch_id("branch_north") == "branch_north"


def test_billing_settings_query_includes_branch():
    assert billing_settings_query("branch_south") == {
        "type": "billing_settings",
        "branch_id": "branch_south",
    }


def test_seed_billing_settings_doc_copies_legacy_pdf_settings():
    legacy = {
        "pdf_documents": {
            "watermark_enabled": False,
            "theme_colors": {"invoice_paid": "#111111"},
        },
        "seller_voucher": {"top_feed_lines": 10},
        "iva_rate": 18,
    }
    doc = seed_billing_settings_doc(
        branch_id="branch_north",
        legacy=legacy,
        default_pdf_documents=DEFAULT_PDF_DOCUMENT_SETTINGS,
        normalize_pdf_documents=normalize_pdf_document_settings,
        normalize_seller_voucher_settings=normalize_seller_voucher_settings,
        default_cancel_reasons=[],
        utc_now_iso="2026-07-04T12:00:00+00:00",
    )
    assert doc["branch_id"] == "branch_north"
    assert doc["pdf_documents"]["watermark_enabled"] is False
    assert doc["seller_voucher"]["top_feed_lines"] == 10
    assert doc["iva_rate"] == 18.0


def test_finalize_billing_settings_doc_fills_defaults():
    doc = finalize_billing_settings_doc(
        {"branch_id": "branch_main", "exchange": {"official_rate": 37}},
        default_pdf_documents=DEFAULT_PDF_DOCUMENT_SETTINGS,
        normalize_pdf_documents=normalize_pdf_document_settings,
        normalize_seller_voucher_settings=normalize_seller_voucher_settings,
        default_cancel_reasons=[{"id": "r1", "reason": "Test", "active": True, "sort_order": 1}],
    )
    assert doc["branch_id"] == "branch_main"
    assert doc["exchange"]["official_rate"] == 37
    assert doc["pdf_documents"]["watermark_enabled"] is True
    assert doc["cancel_reasons"][0]["reason"] == "Test"


def test_billing_legacy_settings_query_matches_old_global_doc():
    query = billing_legacy_settings_query()
    assert query["type"] == "billing_settings"
    assert "$or" in query