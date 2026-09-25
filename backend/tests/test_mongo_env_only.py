import os
import unittest
from unittest.mock import patch
from backend.db.distributed import resolve_local_mongo_uri


class TestMongoEnvOnly(unittest.TestCase):
    def test_no_hardcoded_atlas_uri_in_module(self):
        import backend.db.distributed as dist_mod
        self.assertFalse(hasattr(dist_mod, "DEFAULT_PROD_ATLAS_URI"))

    def test_resolve_with_mongo_url_set(self):
        custom_uri = "mongodb://custom_user:custom_pass@mycluster.example.com/mydb"
        with patch.dict(os.environ, {"MONGO_URL": custom_uri}, clear=True):
            self.assertEqual(resolve_local_mongo_uri(), custom_uri)

    def test_resolve_with_mongodb_local_uri_set(self):
        custom_uri = "mongodb://local_user:local_pass@mycluster.example.com/mydb"
        with patch.dict(os.environ, {"MONGODB_LOCAL_URI": custom_uri}, clear=True):
            self.assertEqual(resolve_local_mongo_uri(), custom_uri)

    def test_fail_fast_on_cloud_run_without_mongo_env(self):
        # K_SERVICE set indicates Google Cloud Run environment
        with patch.dict(os.environ, {"K_SERVICE": "mclarens-erp"}, clear=True):
            with self.assertRaises(RuntimeError) as ctx:
                resolve_local_mongo_uri()
            self.assertIn("CRITICAL: MONGO_URL/MONGODB_URI no está configurada", str(ctx.exception))

    def test_fallback_localhost_in_local_development(self):
        # No K_SERVICE and no MONGO_URL -> fallback to localhost
        with patch.dict(os.environ, {}, clear=True):
            self.assertEqual(resolve_local_mongo_uri(), "mongodb://localhost:27017")


if __name__ == "__main__":
    unittest.main()
