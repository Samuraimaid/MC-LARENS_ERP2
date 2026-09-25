import hashlib
import json
import os
import unittest
import bcrypt


class TestP1PinSync(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        cls.pins_path = os.path.join(base_dir, "data", "seeds", "pins_table.json")
        cls.core_path = os.path.join(base_dir, "data", "seeds", "core_seed.json")
        with open(cls.pins_path, "r", encoding="utf-8") as f:
            cls.pins_table = json.load(f)
        with open(cls.core_path, "r", encoding="utf-8") as f:
            cls.core_seed = json.load(f)
        cls.users_by_email = {
            u.get("email"): u for u in cls.core_seed.get("collections", {}).get("users", [])
        }

    def test_canonical_targets(self):
        targets = {
            "test_coordinador_instalaciones@local": {
                "role": "coordinador_instalaciones",
                "login_pin": "00130009",
                "attendance_pin": "0013",
            },
            "test_coordinador_polarizados@local": {
                "role": "coordinador_polarizados",
                "login_pin": "00140000",
                "attendance_pin": "0014",
            },
            "test_bodegas@local": {
                "role": "bodegas",
                "login_pin": "33445566",
                "attendance_pin": "3344",
            },
            "test_entregador@local": {
                "role": "entregador",
                "login_pin": "00150005",
                "attendance_pin": "0015",
            },
            "qa.apr2026.branch-main.bodegas@pin.local": {
                "role": "bodegas",
                "login_pin": "41090003",
                "attendance_pin": "4109",
            },
            "test_instalaciones@local": {
                "role": "instalaciones",
                "login_pin": "44556677",
                "attendance_pin": "4455",
            },
            "test_electrico@local": {
                "role": "electrico",
                "login_pin": "66778899",
                "attendance_pin": "6677",
            },
            "test_polarizador@local": {
                "role": "polarizador",
                "login_pin": "77889900",
                "attendance_pin": "7788",
            },
            "xinon@local": {
                "role": "gerencia",
                "login_pin": "01011990",
                "attendance_pin": "0101",
            },
        }

        for email, expected in targets.items():
            user = self.users_by_email.get(email)
            self.assertIsNotNone(user, f"User {email} not found in core_seed.json")
            self.assertEqual(user.get("role"), expected["role"], f"Role mismatch for {email}")
            self.assertEqual(user.get("kiosk_pin_plain"), expected["attendance_pin"])

            # Verify SHA-256 indices
            exp_login_idx = hashlib.sha256(expected["login_pin"].encode("utf-8")).hexdigest()
            exp_att_idx = hashlib.sha256(expected["attendance_pin"].encode("utf-8")).hexdigest()
            self.assertEqual(user.get("login_pin_index"), exp_login_idx)
            self.assertEqual(user.get("attendance_pin_index"), exp_att_idx)

            # Verify bcrypt hashes
            self.assertTrue(
                bcrypt.checkpw(expected["login_pin"].encode("utf-8"), user.get("login_pin_hash").encode("utf-8")),
                f"Bcrypt login hash mismatch for {email}",
            )
            self.assertTrue(
                bcrypt.checkpw(expected["attendance_pin"].encode("utf-8"), user.get("attendance_pin_hash").encode("utf-8")),
                f"Bcrypt attendance hash mismatch for {email}",
            )

    def test_bodegas_entregador_swap_undone(self):
        bodegas = self.users_by_email.get("test_bodegas@local")
        entregador = self.users_by_email.get("test_entregador@local")
        self.assertEqual(bodegas.get("role"), "bodegas")
        self.assertEqual(entregador.get("role"), "entregador")
        self.assertEqual(bodegas.get("kiosk_pin_plain"), "3344")
        self.assertEqual(entregador.get("kiosk_pin_plain"), "0015")


if __name__ == "__main__":
    unittest.main()
