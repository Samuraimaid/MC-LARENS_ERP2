"""
Backend API Tests for MUNDO DE ACCESORIOS ERP System
Tests: Root, Seed, Categories, Products CRUD, Deliveries, Credits, Promotions
"""
import os
from datetime import datetime, timedelta

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001")


class TestRootAndSeed:
    """Test root endpoint and seed data creation"""

    def test_root_endpoint(self):
        """Test /api/ returns correct response"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert data["message"] == "MUNDO DE ACCESORIOS ERP API"
        assert "version" in data
        print(f"✓ Root endpoint working: {data}")

    def test_seed_endpoint(self):
        """Test /api/seed creates test data"""
        response = requests.post(f"{BASE_URL}/api/seed")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "products" in data
        assert "categories" in data
        assert data["products"] > 0
        assert len(data["categories"]) == 4  # 4 main categories
        print(
            f"✓ Seed endpoint working: {data['products']} products, {len(data['categories'])} categories"
        )


class TestAuthentication:
    """Test authentication endpoints"""

    def test_create_test_session(self):
        """Test creating a test session for authenticated requests"""
        response = requests.post(f"{BASE_URL}/api/test/create-session")
        assert response.status_code == 200
        data = response.json()
        assert "user" in data
        assert "session_token" in data
        assert data["user"]["role"] == "gerencia"
        print(f"✓ Test session created for user: {data['user']['name']}")
        return data["session_token"]


@pytest.fixture(scope="module")
def auth_session():
    """Create authenticated session for tests"""
    session = requests.Session()
    response = session.post(f"{BASE_URL}/api/test/create-session")
    if response.status_code == 200:
        data = response.json()
        session.cookies.set("session_token", data["session_token"])
        return session
    pytest.skip("Could not create test session")


class TestCategories:
    """Test categories endpoint"""

    def test_get_categories(self, auth_session):
        """Test /api/categories returns product categories"""
        response = auth_session.get(f"{BASE_URL}/api/categories")
        assert response.status_code == 200
        data = response.json()

        # Verify structure
        assert "categories" in data
        assert "vehicle_types" in data
        assert "window_options" in data

        # Verify categories
        categories = data["categories"]
        assert "accesorios_no_electricos" in categories
        assert "accesorios_electronicos" in categories
        assert "polarizados" in categories
        assert "servicios" in categories

        # Verify subcategories exist
        assert "subcategories" in categories["accesorios_no_electricos"]
        assert len(categories["accesorios_no_electricos"]["subcategories"]) > 0

        print(f"✓ Categories endpoint working: {len(categories)} categories")
        print(f"  - Vehicle types: {len(data['vehicle_types'])}")
        print(f"  - Window options: {len(data['window_options'])}")


class TestProducts:
    """Test products CRUD with new fields"""

    def test_get_products(self, auth_session):
        """Test GET /api/products"""
        response = auth_session.get(f"{BASE_URL}/api/products")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET products: {len(data)} products found")

        # Verify product structure if products exist
        if len(data) > 0:
            product = data[0]
            assert "product_id" in product
            assert "sku" in product
            assert "name" in product
            assert "category" in product
            assert "price" in product
            print(f"  - Sample product: {product['name']} ({product['category']})")

    def test_get_products_by_category(self, auth_session):
        """Test filtering products by category"""
        response = auth_session.get(
            f"{BASE_URL}/api/products?category=accesorios_electronicos"
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

        # All products should be in the specified category
        for product in data:
            assert product["category"] == "accesorios_electronicos"
        print(f"✓ Products filtered by category: {len(data)} electronic accessories")

    def test_create_product_with_new_fields(self, auth_session):
        """Test POST /api/products with category, subcategory, compatibility, images"""
        new_product = {
            "sku": f"TEST-{datetime.now().strftime('%H%M%S')}",
            "name": "TEST Defensa Frontal Premium",
            "description": "Defensa frontal de acero inoxidable para pickup",
            "category": "accesorios_no_electricos",
            "subcategory": "Defensas",
            "brand": "TestBrand",
            "price": 299.99,
            "cost": 150.00,
            "product_type": "product",
            "images": [
                "https://example.com/image1.jpg",
                "https://example.com/image2.jpg",
            ],
            "compatibility": {
                "brands": ["Toyota", "Nissan"],
                "models": ["Hilux", "Frontier"],
                "year_from": 2015,
                "year_to": 2024,
                "vehicle_types": ["Pickup", "Camioneta Doble Cabina"],
            },
            "installation_required": True,
            "installation_price": 50.00,
            "installation_time_minutes": 90,
            "warranty_months": 24,
        }

        response = auth_session.post(f"{BASE_URL}/api/products", json=new_product)
        assert response.status_code == 200
        data = response.json()

        # Verify all fields
        assert data["sku"] == new_product["sku"]
        assert data["name"] == new_product["name"]
        assert data["category"] == "accesorios_no_electricos"
        assert data["subcategory"] == "Defensas"
        assert data["images"] == new_product["images"]
        assert data["compatibility"]["brands"] == ["Toyota", "Nissan"]
        assert data["installation_required"] is True
        assert data["installation_price"] == 50.00

        print(f"✓ Product created with new fields: {data['name']}")
        print(f"  - Category: {data['category']}/{data['subcategory']}")
        print(f"  - Images: {len(data['images'])}")
        print(f"  - Compatibility: {data['compatibility']['brands']}")

        return data["product_id"]

    def test_get_product_by_id(self, auth_session):
        """Test GET /api/products/{product_id}"""
        # First get a product
        response = auth_session.get(f"{BASE_URL}/api/products")
        products = response.json()
        if len(products) == 0:
            pytest.skip("No products to test")

        product_id = products[0]["product_id"]
        response = auth_session.get(f"{BASE_URL}/api/products/{product_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["product_id"] == product_id
        print(f"✓ GET product by ID: {data['name']}")

    def test_update_product(self, auth_session):
        """Test PUT /api/products/{product_id}"""
        # First create a product to update
        new_product = {
            "sku": f"TEST-UPD-{datetime.now().strftime('%H%M%S')}",
            "name": "TEST Product for Update",
            "description": "Original description",
            "category": "accesorios_no_electricos",
            "subcategory": "Defensas",
            "brand": "TestBrand",
            "price": 199.99,
            "cost": 100.00,
            "product_type": "product",
            "warranty_months": 12,
        }

        create_response = auth_session.post(
            f"{BASE_URL}/api/products", json=new_product
        )
        assert create_response.status_code == 200
        product_id = create_response.json()["product_id"]

        # Update the product
        updates = {"price": 399.99, "description": "Updated description"}
        response = auth_session.put(
            f"{BASE_URL}/api/products/{product_id}", json=updates
        )
        assert response.status_code == 200

        # Verify update persisted
        get_response = auth_session.get(f"{BASE_URL}/api/products/{product_id}")
        assert get_response.status_code == 200
        updated_product = get_response.json()
        assert updated_product["price"] == 399.99
        assert updated_product["description"] == "Updated description"

        print(f"✓ Product updated: {product_id}")


class TestDeliveries:
    """Test deliveries endpoint"""

    def test_get_deliveries(self, auth_session):
        """Test GET /api/deliveries"""
        response = auth_session.get(f"{BASE_URL}/api/deliveries")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET deliveries: {len(data)} deliveries found")

        # Verify delivery structure if deliveries exist
        if len(data) > 0:
            delivery = data[0]
            assert "sale_id" in delivery
            assert "delivery_required" in delivery
            assert delivery["delivery_required"] is True
            print(f"  - Sample delivery: {delivery.get('invoice_number', 'N/A')}")

    def test_get_deliveries_by_status(self, auth_session):
        """Test filtering deliveries by status"""
        response = auth_session.get(f"{BASE_URL}/api/deliveries?status=pending")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Pending deliveries: {len(data)}")

    def test_get_available_drivers(self, auth_session):
        """Test GET /api/deliveries/drivers"""
        response = auth_session.get(f"{BASE_URL}/api/deliveries/drivers")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Available drivers: {len(data)}")


class TestCredits:
    """Test credit payment endpoints"""

    def test_get_pending_credits(self, auth_session):
        """Test GET /api/credit/pending"""
        response = auth_session.get(f"{BASE_URL}/api/credit/pending")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET pending credits: {len(data)} credit sales found")

        # Verify credit structure if credits exist
        if len(data) > 0:
            credit = data[0]
            assert "sale_id" in credit
            assert "payment_type" in credit
            assert credit["payment_type"] == "credit"
            assert "amount_paid" in credit
            assert "amount_pending" in credit
            pending_amt = credit.get('amount_pending', 0)
            print(f"  - Sample credit: {credit.get('invoice_number', 'N/A')}")
            print(f"    - Pending: ${pending_amt:.2f}")


class TestPromotions:
    """Test promotions CRUD"""

    def test_get_promotions(self, auth_session):
        """Test GET /api/promotions"""
        response = auth_session.get(f"{BASE_URL}/api/promotions")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET promotions: {len(data)} promotions found")

    def test_get_all_promotions(self, auth_session):
        """Test GET /api/promotions with active_only=false"""
        response = auth_session.get(f"{BASE_URL}/api/promotions?active_only=false")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET all promotions (including inactive): {len(data)}")

    def test_create_promotion(self, auth_session):
        """Test POST /api/promotions"""
        now = datetime.now()
        new_promo = {
            "name": f"TEST Promo {now.strftime('%H%M%S')}",
            "description": "Test promotion for automated testing",
            "discount_type": "percentage",
            "discount_value": 15.0,
            "applies_to": "all",
            "category": None,
            "product_ids": None,
            "start_date": now.isoformat(),
            "end_date": (now + timedelta(days=7)).isoformat(),
            "min_purchase": 50.0,
            "is_active": True,
        }

        response = auth_session.post(f"{BASE_URL}/api/promotions", json=new_promo)
        assert response.status_code == 200
        data = response.json()

        assert data["name"] == new_promo["name"]
        assert data["discount_type"] == "percentage"
        assert data["discount_value"] == 15.0
        assert data["applies_to"] == "all"
        assert data["is_active"] is True

        print(f"✓ Promotion created: {data['name']}")
        print(f"  - Discount: {data['discount_value']}%")
        print(f"  - Min purchase: ${data['min_purchase']}")

        return data["promotion_id"]

    def test_update_promotion(self, auth_session):
        """Test PUT /api/promotions/{promotion_id}"""
        # First create a promotion
        now = datetime.now()
        new_promo = {
            "name": f"TEST Update Promo {now.strftime('%H%M%S')}",
            "description": "Test promotion for update",
            "discount_type": "fixed",
            "discount_value": 10.0,
            "applies_to": "all",
            "start_date": now.isoformat(),
            "end_date": (now + timedelta(days=7)).isoformat(),
            "min_purchase": 0,
            "is_active": True,
        }

        create_response = auth_session.post(
            f"{BASE_URL}/api/promotions", json=new_promo
        )
        assert create_response.status_code == 200
        promo_id = create_response.json()["promotion_id"]

        # Update the promotion
        updates = {"discount_value": 20.0, "is_active": False}
        response = auth_session.put(
            f"{BASE_URL}/api/promotions/{promo_id}", json=updates
        )
        assert response.status_code == 200
        print(f"✓ Promotion updated: {promo_id}")

    def test_delete_promotion(self, auth_session):
        """Test DELETE /api/promotions/{promotion_id}"""
        # First create a promotion
        now = datetime.now()
        new_promo = {
            "name": f"TEST Delete Promo {now.strftime('%H%M%S')}",
            "description": "Test promotion for deletion",
            "discount_type": "percentage",
            "discount_value": 5.0,
            "applies_to": "all",
            "start_date": now.isoformat(),
            "end_date": (now + timedelta(days=1)).isoformat(),
            "min_purchase": 0,
            "is_active": False,
        }

        create_response = auth_session.post(
            f"{BASE_URL}/api/promotions", json=new_promo
        )
        assert create_response.status_code == 200
        promo_id = create_response.json()["promotion_id"]

        # Delete the promotion
        response = auth_session.delete(f"{BASE_URL}/api/promotions/{promo_id}")
        assert response.status_code == 200
        print(f"✓ Promotion deleted: {promo_id}")


class TestBranchesAndWarehouses:
    """Test branches and warehouses endpoints"""

    def test_get_branches(self, auth_session):
        """Test GET /api/branches"""
        response = auth_session.get(f"{BASE_URL}/api/branches")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET branches: {len(data)} branches found")

    def test_get_warehouses(self, auth_session):
        """Test GET /api/warehouses"""
        response = auth_session.get(f"{BASE_URL}/api/warehouses")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET warehouses: {len(data)} warehouses found")


class TestInventory:
    """Test inventory endpoints"""

    def test_get_inventory(self, auth_session):
        """Test GET /api/inventory"""
        response = auth_session.get(f"{BASE_URL}/api/inventory")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET inventory: {len(data)} inventory items found")

    def test_get_low_stock(self, auth_session):
        """Test GET /api/inventory with low_stock filter"""
        response = auth_session.get(f"{BASE_URL}/api/inventory?low_stock=true")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Low stock items: {len(data)}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
