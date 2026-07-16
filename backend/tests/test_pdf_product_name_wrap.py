"""Product names in letter PDFs wrap to multiple lines instead of truncating."""

from __future__ import annotations

import pytest

pytest.importorskip("reportlab")

from backend.domains.export.pdf_documents import (
    _item_display_name,
    _pdf_item_row_height,
    _wrap_pdf_text_lines,
    build_preview_pdf_bytes,
)


LONG_PRODUCT_NAME = (
    'Radio Android 10" Toyota Universal Bluetooth CarPlay '
    "con pantalla tactil y camara de reversa incluida"
)


class TestPdfProductNameWrap:
    def test_wrap_pdf_text_lines_splits_long_name(self):
        lines = _wrap_pdf_text_lines(
            LONG_PRODUCT_NAME,
            font_name="Helvetica",
            font_size=8.5,
            max_width=180,
        )
        assert len(lines) >= 2
        joined = " ".join(lines)
        assert "Radio Android" in joined
        assert "reversa incluida" in joined
        assert "…" not in joined

    def test_item_display_name_wraps_with_installation_suffix(self):
        item = {
            "product_name": LONG_PRODUCT_NAME,
            "installation_type": "optional",
            "with_installation": True,
            "installation_price": 25,
        }
        display = _item_display_name(item)
        lines = _wrap_pdf_text_lines(
            display,
            font_name="Helvetica",
            font_size=8.5,
            max_width=180,
        )
        assert len(lines) >= 2
        assert "(+ Instalación)" in display

    def test_row_height_grows_with_wrapped_lines(self):
        assert _pdf_item_row_height(1) == 16
        assert _pdf_item_row_height(3) == 40

    def test_invoice_preview_pdf_contains_full_product_name(self):
        pdf_bytes = build_preview_pdf_bytes(
            preview_kind="invoice_credit",
            company={"name": "MUNDO DE ACCESORIOS", "branch_id": "branch_main"},
            currencies={"NIO": {"symbol": "C$"}},
            logger=None,
        )
        assert pdf_bytes.startswith(b"%PDF")