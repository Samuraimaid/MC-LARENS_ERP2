"""Cashier invoice purge permissions and helpers."""

from backend.server import _cashier_invoice_is_purgeable, _cashier_open_invoice_query


class TestCashierInvoicePurge:
    def test_pending_without_payments_is_bulk_purgeable(self):
        sale = {
            "invoice_state": "open",
            "payment_status": "pending",
            "amount_paid": 0,
        }
        assert _cashier_invoice_is_purgeable(sale, bulk=True) is True

    def test_partial_payment_not_bulk_purgeable(self):
        sale = {
            "invoice_state": "open",
            "payment_status": "partial",
            "amount_paid": 100,
        }
        assert _cashier_invoice_is_purgeable(sale, bulk=True) is False
        assert _cashier_invoice_is_purgeable(sale, bulk=False) is True

    def test_paid_invoice_not_purgeable(self):
        sale = {
            "invoice_state": "open",
            "payment_status": "paid",
            "amount_paid": 1000,
        }
        assert _cashier_invoice_is_purgeable(sale, bulk=False) is False

    def test_open_invoice_query_excludes_credit_on_cotizacion(self):
        query = _cashier_open_invoice_query(tab="cotizacion", branch_id="branch_main")
        assert query["branch_id"] == "branch_main"
        assert query["payment_type"] == {"$nin": ["credit", "credito"]}