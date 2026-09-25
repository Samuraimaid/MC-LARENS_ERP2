import unittest
from backend.core.validation_encoding import validate_cashier_collect_input


def validate_collect_amount_gate(amount: float, pending: float, allow_partial: bool = False):
    """
    Pure validation logic mirroring collect_sale_invoice amount & partial gating.
    """
    rounded_amount = round(float(amount), 2)
    rounded_pending = round(float(pending), 2)

    if rounded_amount > rounded_pending:
        raise ValueError("El cobro excede el pendiente")

    if rounded_amount < round(rounded_pending - 0.009, 2) and not allow_partial:
        return {
            "status_code": 400,
            "error": "AMOUNT_MISMATCH",
            "message": f"El monto a cobrar (C${rounded_amount:.2f}) es menor al saldo pendiente (C${rounded_pending:.2f}) sin 'allow_partial=true'",
            "amount": rounded_amount,
            "pending": rounded_pending,
        }

    return {"status_code": 200, "amount": rounded_amount, "pending": rounded_pending}


class TestCashierCollectPartial(unittest.TestCase):
    def test_underpay_without_allow_partial_returns_amount_mismatch(self):
        # Case: Attempting to collect $0.01 on a $100.00 pending invoice without allow_partial
        res = validate_collect_amount_gate(amount=0.01, pending=100.0, allow_partial=False)
        self.assertEqual(res["status_code"], 400)
        self.assertEqual(res["error"], "AMOUNT_MISMATCH")
        self.assertIn("allow_partial=true", res["message"])

    def test_underpay_with_allow_partial_true_succeeds(self):
        # Case: Legitimate partial payment / abono
        res = validate_collect_amount_gate(amount=25.0, pending=100.0, allow_partial=True)
        self.assertEqual(res["status_code"], 200)
        self.assertEqual(res["amount"], 25.0)

    def test_full_payment_succeeds_without_allow_partial(self):
        # Case: Exact payment
        res = validate_collect_amount_gate(amount=100.0, pending=100.0, allow_partial=False)
        self.assertEqual(res["status_code"], 200)
        self.assertEqual(res["amount"], 100.0)

    def test_overpay_raises_error(self):
        # Case: Amount exceeds pending
        with self.assertRaises(ValueError) as ctx:
            validate_collect_amount_gate(amount=105.0, pending=100.0, allow_partial=True)
        self.assertIn("excede el pendiente", str(ctx.exception))

    def test_validate_cashier_collect_input_preserves_allow_partial(self):
        raw_payload = {
            "sesion_id": "caja_ses_12345",
            "amount": 50.0,
            "allow_partial": True,
        }
        clean = validate_cashier_collect_input(raw_payload)
        self.assertTrue(clean["allow_partial"])

        raw_payload_default = {
            "sesion_id": "caja_ses_12345",
            "amount": 50.0,
        }
        clean_default = validate_cashier_collect_input(raw_payload_default)
        self.assertFalse(clean_default["allow_partial"])


if __name__ == "__main__":
    unittest.main()
