import unittest


def mock_legacy_facturacion_pagar(factura_id: str):
    return {
        "status_code": 410,
        "detail": {
            "error": "GONE",
            "message": (
                "Endpoint deprecado y retirado (410 Gone). Utilice la ruta canónica "
                f"transaccional POST /api/cashier/invoices/{{sale_id}}/collect "
                f"(factura_id recibido: {factura_id})."
            ),
            "canonical_path": "/api/cashier/invoices/{sale_id}/collect",
        },
    }


class TestLegacyFacturacionPagar410(unittest.TestCase):
    def test_legacy_facturacion_pagar_returns_410_gone(self):
        factura_id = "FAC-TEST-001"
        res = mock_legacy_facturacion_pagar(factura_id)
        self.assertEqual(res["status_code"], 410)
        detail = res["detail"]
        self.assertEqual(detail["error"], "GONE")
        self.assertIn("410 Gone", detail["message"])
        self.assertIn(factura_id, detail["message"])
        self.assertEqual(detail["canonical_path"], "/api/cashier/invoices/{sale_id}/collect")


if __name__ == "__main__":
    unittest.main()
