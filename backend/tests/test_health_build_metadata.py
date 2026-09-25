import os
import unittest
from unittest.mock import patch


def get_build_health_metadata():
    version = os.environ.get("BUILD_VERSION") or os.environ.get("APP_VERSION", "dev")
    build_time = os.environ.get("BUILD_TIMESTAMP") or os.environ.get("BUILD_TIME", "")
    build_id = os.environ.get("BUILD_ID") or (f"build_{version}" if version != "dev" else "")
    return {
        "status": "ok",
        "healthy": True,
        "message": "MUNDO DE ACCESORIOS ERP API",
        "version": version,
        "build_version": version,
        "build_time": build_time,
        "build_timestamp": build_time,
        "build_id": build_id,
    }


class TestHealthBuildMetadata(unittest.TestCase):
    def test_default_metadata_without_env(self):
        with patch.dict(os.environ, {}, clear=True):
            meta = get_build_health_metadata()
            self.assertEqual(meta["status"], "ok")
            self.assertEqual(meta["version"], "dev")
            self.assertEqual(meta["build_version"], "dev")
            self.assertEqual(meta["build_time"], "")
            self.assertEqual(meta["build_timestamp"], "")
            self.assertEqual(meta["build_id"], "")

    def test_metadata_with_build_env_vars(self):
        env_vars = {
            "BUILD_VERSION": "0.2.0-20260925_073000",
            "BUILD_TIMESTAMP": "2026-09-25T07:30:00Z",
        }
        with patch.dict(os.environ, env_vars, clear=True):
            meta = get_build_health_metadata()
            self.assertEqual(meta["status"], "ok")
            self.assertEqual(meta["version"], "0.2.0-20260925_073000")
            self.assertEqual(meta["build_version"], "0.2.0-20260925_073000")
            self.assertEqual(meta["build_time"], "2026-09-25T07:30:00Z")
            self.assertEqual(meta["build_timestamp"], "2026-09-25T07:30:00Z")
            self.assertEqual(meta["build_id"], "build_0.2.0-20260925_073000")


if __name__ == "__main__":
    unittest.main()
