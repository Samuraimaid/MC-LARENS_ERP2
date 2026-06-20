import sys

import requests


class MundoAccesoriosAPITester:
    def __init__(self, base_url="https://carlite-admin.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.session = requests.Session()
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.passed_tests = []
        self.auth_token = None

    def log_test(self, name, success, status_code=None, error=None):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            self.passed_tests.append(name)
            print(f"✅ {name} - Status: {status_code}")
        else:
            self.failed_tests.append(
                {
                    "test": name,
                    "status_code": status_code,
                    "error": str(error) if error else "Unknown error",
                }
            )
            print(f"❌ {name} - Status: {status_code}, Error: {error}")

    def test_create_session(self):
        """Test 0: Create test session for authentication"""
        try:
            response = self.session.post(f"{self.base_url}/test/create-session")
            success = response.status_code == 200
            self.log_test("Create test session", success, response.status_code)
            if success:
                data = response.json()
                self.auth_token = data.get("session_token")
                # Set authorization header for all future requests
                self.session.headers.update(
                    {"Authorization": f"Bearer {self.auth_token}"}
                )
                print(
                    f"   Session created for user: {data.get('user', {}).get('name', 'N/A')}"
                )
            return success
        except Exception as e:
            self.log_test("Create test session", False, None, e)
            return False

    def test_root_endpoint(self):
        """Test 1: Backend API /api/ root endpoint works"""
        try:
            response = self.session.get(f"{self.base_url}/")
            success = response.status_code == 200
            self.log_test("Root endpoint /api/", success, response.status_code)
            if success:
                data = response.json()
                print(f"   API Message: {data.get('message', 'N/A')}")
            return success
        except Exception as e:
            self.log_test("Root endpoint /api/", False, None, e)
            return False

    def test_seed_endpoint(self):
        """Test 2: Seed data endpoint /api/seed creates test data"""
        try:
            response = self.session.post(f"{self.base_url}/seed")
            success = response.status_code == 200
            self.log_test("Seed data endpoint", success, response.status_code)
            if success:
                data = response.json()
                print(f"   Seed Message: {data.get('message', 'N/A')}")
            return success
        except Exception as e:
            self.log_test("Seed data endpoint", False, None, e)
            return False

    def test_dashboard_stats(self):
        """Test 3: Dashboard stats endpoint /api/dashboard/stats returns correct data"""
        try:
            response = self.session.get(f"{self.base_url}/dashboard/stats")
            success = response.status_code == 200
            self.log_test("Dashboard stats endpoint", success, response.status_code)
            if success:
                data = response.json()
                expected_keys = [
                    "sales_today",
                    "pending_work_orders",
                    "low_stock_items",
                    "pending_deliveries",
                    "credit_pending",
                ]
                has_keys = all(key in data for key in expected_keys)
                if has_keys:
                    sales_today = data.get('sales_today', {}).get('count', 0)
                    pending = data.get('pending_work_orders', 0)
                    print(f"   Stats: Sales today: {sales_today}")
                    print(f"   Pending orders: {pending}")
                else:
                    print("   Warning: Missing expected keys in response")
            return success
        except Exception as e:
            self.log_test("Dashboard stats endpoint", False, None, e)
            return False

    def test_products_crud(self):
        """Test 4: Products CRUD /api/products"""
        try:
            # GET products
            response = self.session.get(f"{self.base_url}/products")
            success = response.status_code == 200
            self.log_test("Products GET", success, response.status_code)

            if success:
                products = response.json()
                print(f"   Found {len(products)} products")

                # Test GET single product if products exist
                if products:
                    product_id = products[0]["product_id"]
                    response = self.session.get(
                        f"{self.base_url}/products/{product_id}"
                    )
                    single_success = response.status_code == 200
                    self.log_test(
                        "Products GET single", single_success, response.status_code
                    )
                    return success and single_success

            return success
        except Exception as e:
            self.log_test("Products CRUD", False, None, e)
            return False

    def test_inventory_crud(self):
        """Test 5: Inventory CRUD /api/inventory"""
        try:
            response = self.session.get(f"{self.base_url}/inventory")
            success = response.status_code == 200
            self.log_test("Inventory GET", success, response.status_code)

            if success:
                inventory = response.json()
                print(f"   Found {len(inventory)} inventory items")

            return success
        except Exception as e:
            self.log_test("Inventory CRUD", False, None, e)
            return False

    def test_customers_crud(self):
        """Test 6: Customers CRUD /api/customers"""
        try:
            response = self.session.get(f"{self.base_url}/customers")
            success = response.status_code == 200
            self.log_test("Customers GET", success, response.status_code)

            if success:
                customers = response.json()
                print(f"   Found {len(customers)} customers")

                # Test GET single customer if customers exist
                if customers:
                    customer_id = customers[0]["customer_id"]
                    response = self.session.get(
                        f"{self.base_url}/customers/{customer_id}"
                    )
                    single_success = response.status_code == 200
                    self.log_test(
                        "Customers GET single", single_success, response.status_code
                    )
                    return success and single_success

            return success
        except Exception as e:
            self.log_test("Customers CRUD", False, None, e)
            return False

    def test_vehicles_crud(self):
        """Test 7: Vehicles CRUD /api/vehicles"""
        try:
            response = self.session.get(f"{self.base_url}/vehicles")
            success = response.status_code == 200
            self.log_test("Vehicles GET", success, response.status_code)

            if success:
                vehicles = response.json()
                print(f"   Found {len(vehicles)} vehicles")

                # Test GET single vehicle if vehicles exist
                if vehicles:
                    vehicle_id = vehicles[0]["vehicle_id"]
                    response = self.session.get(
                        f"{self.base_url}/vehicles/{vehicle_id}"
                    )
                    single_success = response.status_code == 200
                    self.log_test(
                        "Vehicles GET single", single_success, response.status_code
                    )
                    return success and single_success

            return success
        except Exception as e:
            self.log_test("Vehicles CRUD", False, None, e)
            return False

    def test_work_orders_crud(self):
        """Test 8: Work Orders CRUD /api/work-orders"""
        try:
            response = self.session.get(f"{self.base_url}/work-orders")
            success = response.status_code == 200
            self.log_test("Work Orders GET", success, response.status_code)

            if success:
                work_orders = response.json()
                print(f"   Found {len(work_orders)} work orders")

                # Test GET single work order if work orders exist
                if work_orders:
                    wo_id = work_orders[0]["work_order_id"]
                    response = self.session.get(f"{self.base_url}/work-orders/{wo_id}")
                    single_success = response.status_code == 200
                    self.log_test(
                        "Work Orders GET single", single_success, response.status_code
                    )
                    return success and single_success

            return success
        except Exception as e:
            self.log_test("Work Orders CRUD", False, None, e)
            return False

    def test_technician_work_orders(self):
        """Test PWA Technician Work Orders functionality"""
        try:
            # First create a work order for testing
            customers_response = self.session.get(f"{self.base_url}/customers")
            vehicles_response = self.session.get(f"{self.base_url}/vehicles")

            if (
                customers_response.status_code == 200
                and vehicles_response.status_code == 200
            ):
                customers = customers_response.json()
                vehicles = vehicles_response.json()

                if customers and vehicles:
                    # Create a work order
                    work_order_data = {
                        "customer_id": customers[0]["customer_id"],
                        "vehicle_id": vehicles[0]["vehicle_id"],
                        "items": [
                            {
                                "description": "Instalación de alarma",
                                "product_name": "Alarma GPS",
                            }
                        ],
                        "priority": "normal",
                        "estimated_time": 60,
                        "notes": "Test work order for technician",
                    }

                    create_response = self.session.post(
                        f"{self.base_url}/work-orders", json=work_order_data
                    )
                    create_success = create_response.status_code == 200
                    self.log_test(
                        "Create Work Order for Technician",
                        create_success,
                        create_response.status_code,
                    )

                    if create_success:
                        work_order = create_response.json()
                        wo_id = work_order["work_order_id"]

                        # Test technician claiming order (assign technician)
                        update_data = {
                            "status": "pending",
                            "technician_id": "test_user_admin",
                        }
                        claim_response = self.session.put(
                            f"{self.base_url}/work-orders/{wo_id}", json=update_data
                        )
                        claim_success = claim_response.status_code == 200
                        self.log_test(
                            "Technician Claim Order",
                            claim_success,
                            claim_response.status_code,
                        )

                        # Test starting work (pending -> in_progress)
                        start_data = {"status": "in_progress"}
                        start_response = self.session.put(
                            f"{self.base_url}/work-orders/{wo_id}", json=start_data
                        )
                        start_success = start_response.status_code == 200
                        self.log_test(
                            "Start Work Order",
                            start_success,
                            start_response.status_code,
                        )

                        # Test sending to quality check (in_progress -> quality_check)
                        quality_data = {"status": "quality_check"}
                        quality_response = self.session.put(
                            f"{self.base_url}/work-orders/{wo_id}", json=quality_data
                        )
                        quality_success = quality_response.status_code == 200
                        self.log_test(
                            "Send to Quality Check",
                            quality_success,
                            quality_response.status_code,
                        )

                        # Test completing with quality score (quality_check -> completed)
                        complete_data = {
                            "status": "completed",
                            "quality_score": 9,
                            "quality_notes": "Excelente trabajo realizado",
                        }
                        complete_response = self.session.put(
                            f"{self.base_url}/work-orders/{wo_id}", json=complete_data
                        )
                        complete_success = complete_response.status_code == 200
                        self.log_test(
                            "Complete with Quality Score",
                            complete_success,
                            complete_response.status_code,
                        )

                        return (
                            create_success
                            and claim_success
                            and start_success
                            and quality_success
                            and complete_success
                        )

                    return create_success
                else:
                    self.log_test(
                        "Technician Work Orders",
                        False,
                        None,
                        "No customers or vehicles available",
                    )
                    return False
            else:
                self.log_test(
                    "Technician Work Orders",
                    False,
                    None,
                    "Cannot access customers or vehicles",
                )
                return False

        except Exception as e:
            self.log_test("Technician Work Orders", False, None, e)
            return False

    def test_kds_orders(self):
        """Test 9: KDS endpoint /api/kds/orders returns pending work orders"""
        try:
            response = self.session.get(f"{self.base_url}/kds/orders")
            success = response.status_code == 200
            self.log_test("KDS orders endpoint", success, response.status_code)

            if success:
                orders = response.json()
                print(f"   Found {len(orders)} KDS orders")
                # Check if orders have expected structure
                if orders:
                    first_order = orders[0]
                    expected_keys = [
                        "work_order_id",
                        "status",
                        "customer_name",
                        "vehicle_info",
                    ]
                    has_keys = all(key in first_order for key in expected_keys)
                    if not has_keys:
                        print("   Warning: KDS order missing expected keys")

            return success
        except Exception as e:
            self.log_test("KDS orders endpoint", False, None, e)
            return False

    def test_thermal_print(self):
        """Test 10: Thermal print endpoint /api/print/thermal/{sale_id}"""
        try:
            # First get sales to find a sale_id
            response = self.session.get(f"{self.base_url}/sales")
            if response.status_code == 200:
                sales = response.json()
                if sales:
                    sale_id = sales[0]["sale_id"]
                    response = self.session.get(
                        f"{self.base_url}/print/thermal/{sale_id}"
                    )
                    success = response.status_code == 200
                    self.log_test(
                        "Thermal print endpoint", success, response.status_code
                    )
                    if success:
                        print(f"   Thermal receipt generated for sale {sale_id}")
                    return success
                else:
                    print("   No sales found to test thermal print")
                    self.log_test(
                        "Thermal print endpoint", False, None, "No sales data available"
                    )
                    return False
            else:
                self.log_test(
                    "Thermal print endpoint",
                    False,
                    response.status_code,
                    "Cannot access sales data",
                )
                return False
        except Exception as e:
            self.log_test("Thermal print endpoint", False, None, e)
            return False

    def test_pdf_invoice(self):
        """Test 11: PDF invoice endpoint /api/print/invoice-pdf/{sale_id}"""
        try:
            # First get sales to find a sale_id
            response = self.session.get(f"{self.base_url}/sales")
            if response.status_code == 200:
                sales = response.json()
                if sales:
                    sale_id = sales[0]["sale_id"]
                    response = self.session.get(
                        f"{self.base_url}/print/invoice-pdf/{sale_id}"
                    )
                    success = response.status_code == 200
                    self.log_test("PDF invoice endpoint", success, response.status_code)
                    if success:
                        print(f"   PDF invoice generated for sale {sale_id}")
                    return success
                else:
                    print("   No sales found to test PDF invoice")
                    self.log_test(
                        "PDF invoice endpoint", False, None, "No sales data available"
                    )
                    return False
            else:
                self.log_test(
                    "PDF invoice endpoint",
                    False,
                    response.status_code,
                    "Cannot access sales data",
                )
                return False
        except Exception as e:
            self.log_test("PDF invoice endpoint", False, None, e)
            return False

    def test_branches_warehouses(self):
        """Test specific requirements: 3 branches and 8 warehouses"""
        try:
            # Test branches (should have 3)
            response = self.session.get(f"{self.base_url}/branches")
            branches_success = response.status_code == 200
            self.log_test("Branches endpoint", branches_success, response.status_code)

            if branches_success:
                branches = response.json()
                print(f"   Found {len(branches)} branches (expected: 3)")
                if len(branches) == 3:
                    print("   ✅ Correct number of branches")
                else:
                    print("   ⚠️  Expected 3 branches")

            # Test warehouses (should have 8)
            response = self.session.get(f"{self.base_url}/warehouses")
            warehouses_success = response.status_code == 200
            self.log_test(
                "Warehouses endpoint", warehouses_success, response.status_code
            )

            if warehouses_success:
                warehouses = response.json()
                print(f"   Found {len(warehouses)} warehouses (expected: 8)")
                if len(warehouses) == 8:
                    print("   ✅ Correct number of warehouses")
                else:
                    print("   ⚠️  Expected 8 warehouses")

            return branches_success and warehouses_success
        except Exception as e:
            self.log_test("Branches/Warehouses test", False, None, e)
            return False

    def test_additional_endpoints(self):
        """Test additional endpoints for completeness"""
        endpoints = [
            ("/quotations", "Quotations"),
            ("/sales", "Sales"),
            ("/promotions", "Promotions"),
        ]

        all_success = True
        for endpoint, name in endpoints:
            try:
                response = self.session.get(f"{self.base_url}{endpoint}")
                success = response.status_code == 200
                self.log_test(f"{name} endpoint", success, response.status_code)
                if success:
                    data = response.json()
                    print(f"   Found {len(data)} {name.lower()}")
                all_success = all_success and success
            except Exception as e:
                self.log_test(f"{name} endpoint", False, None, e)
                all_success = False

        return all_success

    def run_all_tests(self):
        """Run all backend API tests"""
        print("🚀 Starting MUNDO DE ACCESORIOS ERP Backend API Tests")
        print("=" * 60)

        # Test 0: Create session for authentication
        if not self.test_create_session():
            print("❌ Cannot proceed without authentication")
            return False

        # Test 1: Root endpoint
        self.test_root_endpoint()

        # Test 2: Seed data (this creates test data for other tests)
        self.test_seed_endpoint()

        # Test 3: Dashboard stats
        self.test_dashboard_stats()

        # Test 4-8: CRUD operations
        self.test_products_crud()
        self.test_inventory_crud()
        self.test_customers_crud()
        self.test_vehicles_crud()
        self.test_work_orders_crud()

        # Test 8.1: PWA Technician Work Orders workflow
        self.test_technician_work_orders()

        # Test 9: KDS orders
        self.test_kds_orders()

        # Test 10: Branches and Warehouses (specific requirements)
        self.test_branches_warehouses()

        # Test 11-12: Print endpoints
        self.test_thermal_print()
        self.test_pdf_invoice()

        # Additional endpoints
        self.test_additional_endpoints()

        # Print summary
        print("\n" + "=" * 60)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")

        if self.failed_tests:
            print("\n❌ Failed Tests:")
            for test in self.failed_tests:
                print(f"   - {test['test']}: {test['error']}")

        if self.passed_tests:
            print(f"\n✅ Passed Tests ({len(self.passed_tests)}):")
            for test in self.passed_tests:
                print(f"   - {test}")

        return self.tests_passed == self.tests_run


def main():
    tester = MundoAccesoriosAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
