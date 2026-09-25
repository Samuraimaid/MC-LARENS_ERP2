"""Pack 4b: products catalog/search static routes + openapi.json schema generation."""
from __future__ import annotations

import os
import unittest
from unittest.mock import patch


# Ensure import-time Mongo bootstrap has a URI (no live DB required for these checks).
_TEST_ENV = {
    "MONGO_URL": os.environ.get("MONGO_URL") or "mongodb://localhost:27017",
    "DB_NAME": os.environ.get("DB_NAME") or "mclarens_pack4b_test",
}


def _load_app():
    with patch.dict(os.environ, _TEST_ENV, clear=False):
        from backend.server import app

        return app


class TestPack4bProductsCatalogRoutes(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = _load_app()

    def test_catalog_and_search_registered_before_product_id(self):
        from fastapi.routing import APIRoute

        get_paths = []
        for route in self.app.routes:
            if not isinstance(route, APIRoute):
                continue
            if "GET" not in (route.methods or set()):
                continue
            if route.path.startswith("/api/products"):
                get_paths.append(route.path)

        self.assertIn("/api/products/catalog", get_paths)
        self.assertIn("/api/products/search", get_paths)
        self.assertIn("/api/products/{product_id}", get_paths)
        self.assertLess(
            get_paths.index("/api/products/catalog"),
            get_paths.index("/api/products/{product_id}"),
        )
        self.assertLess(
            get_paths.index("/api/products/search"),
            get_paths.index("/api/products/{product_id}"),
        )

    def test_catalog_and_search_not_swallowed_as_product_id(self):
        """Unauthenticated: aliases must hit require_auth (401), not 'Product not found'."""
        from fastapi.testclient import TestClient

        client = TestClient(self.app)
        for path in ("/api/products/catalog", "/api/products/search"):
            with self.subTest(path=path):
                res = client.get(path)
                self.assertEqual(res.status_code, 401, res.text)
                body = res.json()
                detail = body.get("detail") or body.get("message") or ""
                raw = res.text
                self.assertNotIn("Product not found", raw)
                if isinstance(detail, dict):
                    self.assertNotEqual(detail.get("message"), "Product not found")


class TestPack4bOpenApiSchema(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = _load_app()

    def test_openapi_schema_generates(self):
        schema = self.app.openapi()
        self.assertEqual(schema.get("openapi", "")[:2], "3.")
        paths = schema.get("paths") or {}
        self.assertIn("/api/products/catalog", paths)
        self.assertIn("/api/products/search", paths)
        self.assertIn("get", paths["/api/products/catalog"])
        # Petty-cash payloads must appear (module-level models, Pack 4b root cause)
        components = (schema.get("components") or {}).get("schemas") or {}
        self.assertTrue(
            any("PettyCashSettingsUpdate" in name for name in components),
            f"PettyCashSettingsUpdate missing from schemas: {sorted(components)[:20]}...",
        )

    def test_openapi_json_endpoint_200(self):
        from fastapi.testclient import TestClient

        client = TestClient(self.app)
        res = client.get("/openapi.json")
        self.assertEqual(res.status_code, 200, res.text[:500])
        data = res.json()
        self.assertIn("paths", data)
        self.assertGreater(len(data["paths"]), 100)


class TestPack4bPettyCashModelsModuleLevel(unittest.TestCase):
    def test_models_are_module_level(self):
        from backend.routes import petty_cash_accounting as pca

        self.assertTrue(hasattr(pca, "PettyCashSettingsUpdate"))
        self.assertTrue(hasattr(pca, "PettyCashExpenseCreate"))
        self.assertTrue(issubclass(pca.PettyCashSettingsUpdate, pca._PettyCashFlexibleModel))
        # Instantiation must work (fully defined for OpenAPI/TypeAdapter)
        m = pca.PettyCashSettingsUpdate(fund_amount=100.0)
        self.assertEqual(m.fund_amount, 100.0)


if __name__ == "__main__":
    unittest.main()
