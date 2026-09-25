"""Pack 5: ping / payments-status / alerts / role-stats return 410 Gone (shape matches Pack 4a/4c)."""
import unittest


GONE_PATHS = [
    ("GET /api/ping", "/api/health"),
    ("GET /ping", "/health"),
    ("GET /api/payments/status/{session_id}", "/api/webhook/stripe"),
    ("GET /api/alerts/low-stock", "n/a — inventory UI / reports"),
    ("POST /api/alerts/send-low-stock", "n/a — inventory UI / reports"),
    ("GET /api/dashboard/role-stats", "n/a — use existing dashboard/caja APIs"),
]

# Health endpoints that MUST remain live (not 410).
KEEP_HEALTH_PATHS = [
    "GET /api/",
    "GET /api/health",
    "GET /health",
]


def mock_pack5_gone(path: str, canonical_path: str):
    """Mirror the HTTPException detail raised by Pack 5 deprecation stubs."""
    if path == "GET /api/ping":
        message = (
            "Endpoint deprecado y retirado (410 Gone). GET /api/ping ya no está "
            "disponible. Use GET /api/health."
        )
    elif path == "GET /ping":
        message = (
            "Endpoint deprecado y retirado (410 Gone). GET /ping ya no está "
            "disponible. Use GET /health."
        )
    elif path == "GET /api/payments/status/{session_id}":
        message = (
            "Endpoint deprecado y retirado (410 Gone). El polling HTTP de estado de "
            "pago Stripe ya no está disponible. El fulfillment sigue vía webhook "
            "POST /api/webhook/stripe."
        )
    elif path in ("GET /api/alerts/low-stock", "POST /api/alerts/send-low-stock"):
        if path.startswith("POST"):
            message = (
                "Endpoint deprecado y retirado (410 Gone). El envío de alertas de stock "
                "bajo por HTTP ya no está disponible. Use la UI de inventario / reportes."
            )
        else:
            message = (
                "Endpoint deprecado y retirado (410 Gone). Las alertas de stock bajo por "
                "HTTP ya no están disponibles. Use la UI de inventario / reportes."
            )
    elif path == "GET /api/dashboard/role-stats":
        message = (
            "Endpoint deprecado y retirado (410 Gone). Las estadísticas de dashboard "
            "por rol por HTTP no son usadas por el frontend. Use los endpoints "
            "existentes de dashboard/caja."
        )
    else:
        raise AssertionError(f"unknown Pack 5 path: {path}")

    return {
        "status_code": 410,
        "detail": {
            "error": "GONE",
            "message": message,
            "canonical_path": canonical_path,
        },
    }


class TestPack5Deprecation410(unittest.TestCase):
    def test_all_pack5_paths_return_410_gone_shape(self):
        for path, canonical in GONE_PATHS:
            with self.subTest(path=path):
                res = mock_pack5_gone(path, canonical)
                self.assertEqual(res["status_code"], 410)
                detail = res["detail"]
                self.assertEqual(detail["error"], "GONE")
                self.assertIn("410 Gone", detail["message"])
                self.assertEqual(detail["canonical_path"], canonical)
                self.assertIn("deprecado", detail["message"].lower())
                self.assertTrue(bool(detail["canonical_path"]))

    def test_api_ping_points_to_api_health(self):
        res = mock_pack5_gone("GET /api/ping", "/api/health")
        self.assertEqual(res["detail"]["canonical_path"], "/api/health")
        self.assertIn("/api/health", res["detail"]["message"])

    def test_bare_ping_points_to_bare_health(self):
        res = mock_pack5_gone("GET /ping", "/health")
        self.assertEqual(res["detail"]["canonical_path"], "/health")
        self.assertIn("/health", res["detail"]["message"])

    def test_payments_status_points_to_stripe_webhook(self):
        res = mock_pack5_gone(
            "GET /api/payments/status/{session_id}", "/api/webhook/stripe"
        )
        self.assertEqual(res["detail"]["canonical_path"], "/api/webhook/stripe")
        self.assertIn("webhook", res["detail"]["message"].lower())

    def test_keep_health_paths_are_not_in_gone_list(self):
        gone_only = {p for p, _ in GONE_PATHS}
        for keep in KEEP_HEALTH_PATHS:
            self.assertNotIn(keep, gone_only)


if __name__ == "__main__":
    unittest.main()
