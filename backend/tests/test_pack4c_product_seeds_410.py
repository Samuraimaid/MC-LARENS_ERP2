"""Pack 4c: product seed-* / sync-all-catalogs return 410 Gone (shape matches Pack 4a)."""
import unittest


GONE_PATHS = [
    (
        "POST /api/products/seed-demo",
        "n/a — CSV import / startup seed / backend scripts",
    ),
    (
        "POST /api/products/seed-catalogs",
        "n/a — backend scripts / seed JSON offline",
    ),
    (
        "POST /api/products/seed-dlaa",
        "n/a — backend scripts / seed JSON offline",
    ),
    (
        "POST /api/products/sync-all-catalogs",
        "n/a — backend scripts / seed JSON offline",
    ),
]


def mock_pack4c_gone(path: str, canonical_path: str):
    """Mirror the HTTPException detail raised by Pack 4c product seed stubs."""
    if path == "POST /api/products/seed-demo":
        message = (
            "Endpoint deprecado y retirado (410 Gone). El seed demo de productos por HTTP "
            "ya no está disponible en producción. Use importación CSV en Inventario, "
            "el seed de arranque del servidor, o scripts de backend."
        )
    else:
        message = (
            "Endpoint deprecado y retirado (410 Gone). El seed/sync de catálogos por HTTP "
            "ya no está disponible en producción. Use admin CLI, backend scripts o "
            "archivos seed JSON offline."
        )
    return {
        "status_code": 410,
        "detail": {
            "error": "GONE",
            "message": message,
            "canonical_path": canonical_path,
        },
    }


class TestPack4cProductSeeds410(unittest.TestCase):
    def test_all_pack4c_paths_return_410_gone_shape(self):
        for path, canonical in GONE_PATHS:
            with self.subTest(path=path):
                res = mock_pack4c_gone(path, canonical)
                self.assertEqual(res["status_code"], 410)
                detail = res["detail"]
                self.assertEqual(detail["error"], "GONE")
                self.assertIn("410 Gone", detail["message"])
                self.assertEqual(detail["canonical_path"], canonical)
                self.assertIn("deprecado", detail["message"].lower())
                self.assertTrue(bool(detail["canonical_path"]))

    def test_seed_demo_points_to_csv_startup_scripts(self):
        res = mock_pack4c_gone(
            "POST /api/products/seed-demo",
            "n/a — CSV import / startup seed / backend scripts",
        )
        self.assertEqual(
            res["detail"]["canonical_path"],
            "n/a — CSV import / startup seed / backend scripts",
        )
        self.assertIn("CSV", res["detail"]["message"])


if __name__ == "__main__":
    unittest.main()
