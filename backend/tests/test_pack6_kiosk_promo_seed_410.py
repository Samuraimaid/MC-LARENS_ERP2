"""Pack 6: kiosk mass seed + promo seed-defaults return 410 Gone (shape matches Pack 4a/4c/5)."""
import unittest


GONE_PATHS = [
    (
        "POST /api/users/pin/kiosk/seed",
        "n/a — per-user PIN update / hr timeclock sync / scripts",
    ),
    (
        "POST /api/settings/promotional-videos/seed-defaults",
        "n/a — promotional video upload/create UI",
    ),
]


def mock_pack6_gone(path: str, canonical_path: str):
    """Mirror the HTTPException detail raised by Pack 6 seed stubs."""
    if path == "POST /api/users/pin/kiosk/seed":
        message = (
            "Endpoint deprecado y retirado (410 Gone). El seed masivo de PIN Kiosko por HTTP "
            "ya no está disponible en producción. Use la actualización de PIN Kiosko por usuario "
            "en Administración de Usuarios, POST /api/hr/timeclock/pin-directory/sync, o scripts de backend."
        )
    else:
        message = (
            "Endpoint deprecado y retirado (410 Gone). El seed de videos promocionales de fábrica "
            "por HTTP ya no está disponible en producción. Use la carga/creación de videos "
            "promocionales en Configuración."
        )
    return {
        "status_code": 410,
        "detail": {
            "error": "GONE",
            "message": message,
            "canonical_path": canonical_path,
        },
    }


class TestPack6KioskPromoSeed410(unittest.TestCase):
    def test_all_pack6_paths_return_410_gone_shape(self):
        for path, canonical in GONE_PATHS:
            with self.subTest(path=path):
                res = mock_pack6_gone(path, canonical)
                self.assertEqual(res["status_code"], 410)
                detail = res["detail"]
                self.assertEqual(detail["error"], "GONE")
                self.assertIn("410 Gone", detail["message"])
                self.assertEqual(detail["canonical_path"], canonical)
                self.assertIn("deprecado", detail["message"].lower())
                self.assertTrue(bool(detail["canonical_path"]))

    def test_kiosk_seed_points_to_per_user_and_sync(self):
        res = mock_pack6_gone(
            "POST /api/users/pin/kiosk/seed",
            "n/a — per-user PIN update / hr timeclock sync / scripts",
        )
        self.assertEqual(
            res["detail"]["canonical_path"],
            "n/a — per-user PIN update / hr timeclock sync / scripts",
        )
        self.assertIn("PIN Kiosko", res["detail"]["message"])
        self.assertIn("pin-directory/sync", res["detail"]["message"])

    def test_promo_seed_defaults_points_to_upload_create_ui(self):
        res = mock_pack6_gone(
            "POST /api/settings/promotional-videos/seed-defaults",
            "n/a — promotional video upload/create UI",
        )
        self.assertEqual(
            res["detail"]["canonical_path"],
            "n/a — promotional video upload/create UI",
        )
        self.assertIn("videos promocionales", res["detail"]["message"].lower())
        self.assertIn("Configuración", res["detail"]["message"])


if __name__ == "__main__":
    unittest.main()
