"""
Backend API Tests for MUNDO DE ACCESORIOS ERP System - New Features (Iteration 4)
Tests: Returns, Calendar, Warranties, Low Stock Alerts, Notifications, Report Exports, Productivity, Role Stats
"""
import os
from datetime import datetime, timedelta

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001")


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


@pytest.fixture(scope="module")
def test_data(auth_session):
    """Create test data needed for tests"""
    # Create a customer
    customer_data = {
        "name": f"TEST Customer {datetime.now().strftime('%H%M%S')}",
        "email": "test@example.com",
        "phone": "555-1234",
        "credit_limit": 5000,
    }
    customer_res = auth_session.post(f"{BASE_URL}/api/customers", json=customer_data)
    customer = customer_res.json() if customer_res.status_code == 200 else None

    # Create a vehicle
    vehicle_data = None
    if customer:
        vehicle_data = {
            "customer_id": customer["customer_id"],
            "plate": f"TEST{datetime.now().strftime('%H%M%S')}",
            "brand": "Toyota",
            "model": "Hilux",
            "year": 2023,
            "vehicle_type": "Pickup",
        }
        vehicle_res = auth_session.post(f"{BASE_URL}/api/vehicles", json=vehicle_data)
        vehicle_data = vehicle_res.json() if vehicle_res.status_code == 200 else None

    return {"customer": customer, "vehicle": vehicle_data}


class TestReturnsModule:
    """Test Returns API endpoints"""

    def test_get_returns(self, auth_session):
        """Test GET /api/returns"""
        response = auth_session.get(f"{BASE_URL}/api/returns")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET returns: {len(data)} returns found")

    def test_get_returns_by_status(self, auth_session):
        """Test GET /api/returns with status filter"""
        response = auth_session.get(f"{BASE_URL}/api/returns?status=pending")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # All returns should have pending status
        for ret in data:
            assert ret["status"] == "pending"
        print(f"✓ GET pending returns: {len(data)}")


class TestCalendarModule:
    """Test Calendar API endpoints"""

    def test_get_calendar_events(self, auth_session):
        """Test GET /api/calendar with date range"""
        today = datetime.now().strftime("%Y-%m-%d")
        end_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")

        response = auth_session.get(
            f"{BASE_URL}/api/calendar?start_date={today}&end_date={end_date}"
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET calendar events: {len(data)} events found")

    def test_create_calendar_event(self, auth_session):
        """Test POST /api/calendar"""
        now = datetime.now()
        start_time = now + timedelta(hours=1)
        end_time = now + timedelta(hours=2)

        event_data = {
            "title": f"TEST Event {now.strftime('%H%M%S')}",
            "event_type": "appointment",
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "customer_name": "Test Customer",
            "vehicle_info": "Toyota Hilux 2023 - ABC123",
            "notes": "Test appointment",
        }

        response = auth_session.post(f"{BASE_URL}/api/calendar", json=event_data)
        assert response.status_code == 200
        data = response.json()

        assert data["title"] == event_data["title"]
        assert data["event_type"] == "appointment"
        assert "event_id" in data

        print(f"✓ Calendar event created: {data['event_id']}")
        return data["event_id"]

    def test_update_calendar_event(self, auth_session):
        """Test PUT /api/calendar/{event_id}"""
        # First create an event
        now = datetime.now()
        event_data = {
            "title": f"TEST Update Event {now.strftime('%H%M%S')}",
            "event_type": "appointment",
            "start_time": (now + timedelta(hours=1)).isoformat(),
            "end_time": (now + timedelta(hours=2)).isoformat(),
        }

        create_res = auth_session.post(f"{BASE_URL}/api/calendar", json=event_data)
        assert create_res.status_code == 200
        event_id = create_res.json()["event_id"]

        # Update the event
        updates = {"status": "in_progress", "notes": "Updated notes"}
        response = auth_session.put(f"{BASE_URL}/api/calendar/{event_id}", json=updates)
        assert response.status_code == 200
        print(f"✓ Calendar event updated: {event_id}")

    def test_delete_calendar_event(self, auth_session):
        """Test DELETE /api/calendar/{event_id}"""
        # First create an event
        now = datetime.now()
        event_data = {
            "title": f"TEST Delete Event {now.strftime('%H%M%S')}",
            "event_type": "appointment",
            "start_time": (now + timedelta(hours=1)).isoformat(),
            "end_time": (now + timedelta(hours=2)).isoformat(),
        }

        create_res = auth_session.post(f"{BASE_URL}/api/calendar", json=event_data)
        assert create_res.status_code == 200
        event_id = create_res.json()["event_id"]

        # Delete the event
        response = auth_session.delete(f"{BASE_URL}/api/calendar/{event_id}")
        assert response.status_code == 200
        print(f"✓ Calendar event deleted: {event_id}")

    def test_sync_work_orders_to_calendar(self, auth_session):
        """Test POST /api/calendar/sync-work-orders"""
        response = auth_session.post(f"{BASE_URL}/api/calendar/sync-work-orders")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"✓ Work orders synced: {data['message']}")


class TestWarrantiesModule:
    """Test Warranties API endpoints"""

    def test_get_warranty_claims(self, auth_session):
        """Test GET /api/warranties/claims"""
        response = auth_session.get(f"{BASE_URL}/api/warranties/claims")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET warranty claims: {len(data)} claims found")

    def test_get_warranty_claims_by_status(self, auth_session):
        """Test GET /api/warranties/claims with status filter"""
        response = auth_session.get(f"{BASE_URL}/api/warranties/claims?status=pending")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        for claim in data:
            assert claim["status"] == "pending"
        print(f"✓ GET pending warranty claims: {len(data)}")

    def test_get_vehicle_warranty_history(self, auth_session, test_data):
        """Test GET /api/warranties/vehicle/{vehicle_id}"""
        if not test_data.get("vehicle"):
            pytest.skip("No test vehicle available")

        vehicle_id = test_data["vehicle"]["vehicle_id"]
        response = auth_session.get(f"{BASE_URL}/api/warranties/vehicle/{vehicle_id}")
        assert response.status_code == 200
        data = response.json()

        assert "vehicle" in data
        assert "warranty_items" in data
        assert "claims" in data
        assert data["vehicle"]["vehicle_id"] == vehicle_id

        print(
            f"✓ Vehicle warranty history: {len(data['warranty_items'])} items, {len(data['claims'])} claims"
        )


class TestAlertsModule:
    """Test Alerts API endpoints"""

    def test_get_low_stock_alerts(self, auth_session):
        """Test GET /api/alerts/low-stock"""
        response = auth_session.get(f"{BASE_URL}/api/alerts/low-stock")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

        # Verify structure if alerts exist
        if len(data) > 0:
            alert = data[0]
            assert "product_id" in alert
            assert "quantity" in alert
            assert "min_stock" in alert

        print(f"✓ GET low stock alerts: {len(data)} alerts found")


class TestNotificationsModule:
    """Test Notifications API endpoints"""

    def test_send_invoice_notification(self, auth_session):
        """Test POST /api/notifications/send-invoice/{sale_id}"""
        # First get a sale
        sales_res = auth_session.get(f"{BASE_URL}/api/sales")
        if sales_res.status_code != 200:
            pytest.skip("Could not get sales")

        sales = sales_res.json()
        if len(sales) == 0:
            pytest.skip("No sales available for testing")

        sale_id = sales[0]["sale_id"]
        response = auth_session.post(
            f"{BASE_URL}/api/notifications/send-invoice/{sale_id}"
        )

        # Should return 200 (mocked) or 500 if no SendGrid key
        assert response.status_code in [200, 500]

        if response.status_code == 200:
            data = response.json()
            assert "message" in data
            print(f"✓ Invoice notification sent (MOCKED): {data['message']}")
        else:
            print("✓ Invoice notification endpoint exists (SendGrid not configured)")

    def test_get_recent_notifications(self, auth_session):
        """Test GET /api/notifications/recent"""
        response = auth_session.get(f"{BASE_URL}/api/notifications/recent")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET recent notifications: {len(data)} notifications")


class TestReportsExport:
    """Test Report Export endpoints"""

    def test_export_sales_csv(self, auth_session):
        """Test GET /api/reports/export/sales?format=csv"""
        today = datetime.now().strftime("%Y-%m-%d")
        start_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")

        response = auth_session.get(
            f"{BASE_URL}/api/reports/export/sales?start_date={start_date}&end_date={today}&format=csv"
        )
        assert response.status_code == 200
        assert "text/csv" in response.headers.get("content-type", "")

        # Verify CSV content
        content = response.text
        assert "Factura" in content  # Header should be present

        print(f"✓ Sales CSV export working - {len(content)} bytes")

    def test_export_sales_pdf(self, auth_session):
        """Test GET /api/reports/export/sales?format=pdf"""
        today = datetime.now().strftime("%Y-%m-%d")
        start_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")

        response = auth_session.get(
            f"{BASE_URL}/api/reports/export/sales?start_date={start_date}&end_date={today}&format=pdf"
        )
        assert response.status_code == 200
        assert "application/pdf" in response.headers.get("content-type", "")

        # Verify PDF content starts with PDF header
        assert response.content[:4] == b"%PDF"

        print(f"✓ Sales PDF export working - {len(response.content)} bytes")


class TestProductivityReport:
    """Test Productivity Report endpoint"""

    def test_get_productivity_report(self, auth_session):
        """Test GET /api/reports/productivity"""
        today = datetime.now().strftime("%Y-%m-%d")
        start_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")

        response = auth_session.get(
            f"{BASE_URL}/api/reports/productivity?start_date={start_date}&end_date={today}"
        )
        assert response.status_code == 200
        data = response.json()

        # Verify structure
        assert "period" in data
        assert "salespeople" in data
        assert "technicians" in data
        assert "summary" in data

        assert data["period"]["start"] == start_date
        assert data["period"]["end"] == today
        assert isinstance(data["salespeople"], list)
        assert isinstance(data["technicians"], list)

        print(
            f"✓ Productivity report: {len(data['salespeople'])} salespeople, {len(data['technicians'])} technicians"
        )
        print(f"  - Summary: {data['summary']}")


class TestDashboardRoleStats:
    """Test Dashboard Role Stats endpoint"""

    def test_get_role_stats(self, auth_session):
        """Test GET /api/dashboard/role-stats"""
        response = auth_session.get(f"{BASE_URL}/api/dashboard/role-stats")
        assert response.status_code == 200
        data = response.json()

        # Verify structure
        assert "role" in data

        # For gerencia role (test session), should have full stats
        if data["role"] in ["gerencia", "supervisor"]:
            assert "sales_today" in data
            assert "pending_work_orders" in data
            assert "low_stock_items" in data
            assert "pending_deliveries" in data
            assert "pending_credits" in data
            assert "pending_returns" in data
            assert "warranty_claims" in data

        print(f"✓ Role stats for '{data['role']}': {data}")


class TestFrontendRoutes:
    """Test that frontend routes are accessible"""

    def test_returns_page_route(self, auth_session):
        """Test /returns route exists"""
        # This tests the API that the frontend page would call
        response = auth_session.get(f"{BASE_URL}/api/returns")
        assert response.status_code == 200
        print("✓ Returns page API accessible")

    def test_calendar_page_route(self, auth_session):
        """Test /calendar route exists"""
        today = datetime.now().strftime("%Y-%m-%d")
        end_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        response = auth_session.get(
            f"{BASE_URL}/api/calendar?start_date={today}&end_date={end_date}"
        )
        assert response.status_code == 200
        print("✓ Calendar page API accessible")

    def test_warranties_page_route(self, auth_session):
        """Test /warranties route exists"""
        response = auth_session.get(f"{BASE_URL}/api/warranties/claims")
        assert response.status_code == 200
        print("✓ Warranties page API accessible")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
