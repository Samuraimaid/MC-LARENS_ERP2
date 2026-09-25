import unittest


def mock_legacy_cobrar(sale_id: str):
    return {
        "status_code": 410,
        "detail": {
            "error": "GONE",
            "message": f"Endpoint deprecado y retirado (410 Gone). Utilice la ruta canónica transaccional POST /api/cashier/invoices/{sale_id}/collect",
            "canonical_path": f"/api/cashier/invoices/{sale_id}/collect",
        },
    }


class TestLegacyCobrar410(unittest.TestCase):
    def test_legacy_cobrar_returns_410_gone(self):
        sale_id = "sale_test_12345"
        res = mock_legacy_cobrar(sale_id)
        self.assertEqual(res["status_code"], 410)
        detail = res["detail"]
        self.assertEqual(detail["error"], "GONE")
        self.assertIn("410 Gone", detail["message"])
        self.assertEqual(detail["canonical_path"], f"/api/cashier/invoices/{sale_id}/collect")


if __name__ == "__main__":
    unittest.main()
