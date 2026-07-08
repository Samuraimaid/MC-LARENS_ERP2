"""Cashier invoice item detail mirrors voucher line discounts in settlement currency."""

from backend.server import (
    _cashier_sale_item_detail,
    _cashier_settlement_subtotal,
    _sale_items_preview_for_cashier,
)


def test_cashier_item_detail_includes_price_and_pct_discounts():
    row = _cashier_sale_item_detail(
        {
            "product_name": "Radio Android",
            "quantity": 2,
            "unit_price": 200.0,
            "original_unit_price": 280.0,
            "discount": 10.0,
            "with_installation": True,
            "installation_price": 50.0,
        },
        currency="USD",
        exchange_rate=36.5,
    )

    assert row["name"] == "Radio Android"
    assert row["quantity"] == 2
    assert row["unit_price"] == 200.0
    assert row["original_unit_price"] == 280.0
    assert row["line_pct_discount"] == 56.0
    assert row["price_discount"] == 144.0
    assert row["installation_line_total"] == 100.0
    assert row["line_net_total"] == 500.0
    assert row["has_price_discount"] is True
    assert row["has_line_pct_discount"] is True


def test_cashier_item_detail_converts_usd_prices_to_nio():
    row = _cashier_sale_item_detail(
        {
            "product_name": "Canastero de Techo Universal",
            "quantity": 1,
            "unit_price": 273.972603,
            "original_unit_price": 273.972603,
            "discount": 0.0,
            "with_installation": False,
        },
        currency="NIO",
        exchange_rate=36.5,
    )

    assert row["unit_price"] == 10000.0
    assert row["line_net_total"] == 10000.0


def test_cashier_settlement_subtotal_uses_total_legal_minus_iva():
    sale = {
        "subtotal": 578.08,
        "total_legal": 24265.0,
        "iva_amount": 3165.0,
        "currency": "NIO",
        "exchange_rate": 36.5,
    }
    assert _cashier_settlement_subtotal(sale) == 21100.0


def test_sale_items_preview_for_cashier_matches_voucher_amounts():
    sale = {
        "currency": "NIO",
        "exchange_rate": 36.5,
        "items": [
            {
                "product_name": "Forro de Timón Cuero Negro",
                "quantity": 1,
                "unit_price": 30.136986,
                "original_unit_price": 30.136986,
                "discount": 0.0,
            },
            {
                "product_name": "Alarma Viper 5906V con GPS",
                "quantity": 1,
                "unit_price": 273.972603,
                "original_unit_price": 273.972603,
                "discount": 0.0,
            },
        ],
    }
    preview = _sale_items_preview_for_cashier(sale)
    amounts = [row["line_net_total"] for row in preview["items_detail"]]
    assert amounts == [1100.0, 10000.0]