"""PDF document section toggles and petty cash preview."""

from __future__ import annotations

from backend.domains.export.pdf_document_settings import (
    merge_pdf_document_sections,
    normalize_pdf_document_sections,
    pdf_section_enabled,
)
from backend.domains.export.pdf_documents import build_preview_pdf_bytes, normalize_pdf_document_settings


def test_normalize_pdf_document_sections_defaults():
    sections = normalize_pdf_document_sections(None)
    assert sections["invoice"]["breakdown_iva"] is True
    assert sections["petty_cash"]["category"] is True
    assert sections["payment_receipt"]["amount_pending"] is True


def test_merge_pdf_document_sections_updates_invoice_rows():
    merged = merge_pdf_document_sections(
        normalize_pdf_document_sections({}),
        {"invoice": {"breakdown_iva": False, "vehicle": False}},
    )
    assert merged["invoice"]["breakdown_iva"] is False
    assert merged["invoice"]["document_number"] is True


def test_pdf_section_enabled_respects_breakdown_parent():
    settings = normalize_pdf_document_settings(
        {"sections": {"invoice": {"breakdown": False, "breakdown_iva": True}}}
    )
    assert pdf_section_enabled(settings, "invoice", "breakdown_iva") is False
    assert pdf_section_enabled(settings, "invoice", "document_number") is True


def test_petty_cash_preview_pdf_generates_bytes():
    pdf_bytes = build_preview_pdf_bytes(
        preview_kind="petty_cash",
        company={"name": "MUNDO DE ACCESORIOS", "branch_id": "branch_main"},
        currencies={"NIO": {"symbol": "C$"}},
        logger=None,
    )
    assert pdf_bytes.startswith(b"%PDF")