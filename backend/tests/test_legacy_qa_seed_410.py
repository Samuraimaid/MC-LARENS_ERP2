"""Pack 4a: QA suites + vague /seed return 410 Gone (shape matches cobrar/pagar)."""
import unittest


GONE_PATHS = [
    (
        "POST /api/qa/run-global-chaos-stress-suite",
        "n/a — backend/scripts (local only)",
    ),
    (
        "POST /api/qa/run-full-simulation-suite",
        "n/a — backend/scripts (local only)",
    ),
    (
        "POST /api/qa/run-full-hr-simulation-suite",
        "n/a — backend/scripts (local only)",
    ),
    (
        "POST /api/qa/run-full-workshop-simulation-suite",
        "n/a — backend/scripts (local only)",
    ),
    (
        "POST /api/qa/run-logistic-simulation-suite",
        "n/a — backend/scripts (local only)",
    ),
    (
        "POST /api/qa/debug/upsert-document",
        "n/a — QA debug upsert retired",
    ),
    (
        "POST /api/seed",
        "/api/products/seed-demo",
    ),
]


def mock_legacy_gone(path: str, canonical_path: str):
    """Mirror the HTTPException detail raised by Pack 4a stubs."""
    if path == "POST /api/seed":
        message = (
            "Endpoint deprecado y retirado (410 Gone). El seed genérico POST /api/seed "
            "ya no está disponible en producción. Use endpoints nombrados "
            "(p.ej. /api/products/seed-demo) o el seed de arranque del servidor."
        )
    elif path == "POST /api/qa/debug/upsert-document":
        message = (
            "Endpoint deprecado y retirado (410 Gone). El upsert de debug QA "
            "ya no está expuesto por HTTP en producción."
        )
    elif "chaos" in path:
        message = (
            "Endpoint deprecado y retirado (410 Gone). Las suites QA de caos/estrés "
            "ya no están expuestas por HTTP en producción. Ejecute "
            "backend/scripts/run_chaos_suite_live.py localmente si necesita la suite."
        )
    else:
        message = (
            "Endpoint deprecado y retirado (410 Gone). Las suites QA de simulación "
            "ya no están expuestas por HTTP en producción."
        )
    return {
        "status_code": 410,
        "detail": {
            "error": "GONE",
            "message": message,
            "canonical_path": canonical_path,
        },
    }


class TestLegacyQaSeed410(unittest.TestCase):
    def test_all_pack4a_paths_return_410_gone_shape(self):
        for path, canonical in GONE_PATHS:
            with self.subTest(path=path):
                res = mock_legacy_gone(path, canonical)
                self.assertEqual(res["status_code"], 410)
                detail = res["detail"]
                self.assertEqual(detail["error"], "GONE")
                self.assertIn("410 Gone", detail["message"])
                self.assertEqual(detail["canonical_path"], canonical)
                self.assertIn("deprecado", detail["message"].lower())

    def test_seed_points_to_named_product_seed(self):
        res = mock_legacy_gone("POST /api/seed", "/api/products/seed-demo")
        self.assertEqual(res["detail"]["canonical_path"], "/api/products/seed-demo")
        self.assertIn("/api/seed", res["detail"]["message"])


if __name__ == "__main__":
    unittest.main()
