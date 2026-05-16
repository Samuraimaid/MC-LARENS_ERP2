import requests
import json

base_url = "http://localhost:8001/api"

# 1. Get users and find a 'ventas' user
resp = requests.get(f"{base_url}/auth/pin/users")
users = resp.json()
ventas_user = next((u for u in users if u.get('role') == 'ventas' and u.get('is_active')), None)

if not ventas_user:
    roles = {}
    for u in users:
        r = u.get('role')
        roles[r] = roles.get(r, 0) + 1
    print(json.dumps({"error": "No ventas user found", "roles": roles}))
    exit(0)

user_id = ventas_user['id']

# 2. Login
login_payload = {"pin": "01011990", "user_id": user_id}
session = requests.Session()
login_resp = session.post(f"{base_url}/auth/pin/login", json=login_payload)
print(f"Login Status: {login_resp.status_code}")

# 3. Verify discount policy
policy_resp = session.get(f"{base_url}/settings/discount-policy/seller")
print(f"Policy Status: {policy_resp.status_code}")
print(f"Policy Body: {policy_resp.text}")

# 4. Get customer and product
# We need to find the correct endpoints if these fail
customers_resp = session.get(f"{base_url}/customers")
customer = customers_resp.json()[0] if customers_resp.status_code == 200 and customers_resp.json() else None

products_resp = session.get(f"{base_url}/products")
product = products_resp.json()[0] if products_resp.status_code == 200 and products_resp.json() else None

if not customer or not product:
    print(f"Failed to get customer or product. Customer: {customer is not None}, Product: {product is not None}")
    # Try different endpoints if common ones fail
    exit(0)

# 5. POST quotation
# Checking routes for quotations
quotation_payload = {
    "customer_id": customer['id'],
    "items": [
        {
            "product_id": product['id'],
            "quantity": 1,
            "unit_price": product.get('price', product.get('sale_price', 100))
        }
    ],
    "discount": 10
}

# Common endpoints for quotations: /quotations or /sales/quotations
q_resp = session.post(f"{base_url}/quotations", json=quotation_payload)
if q_resp.status_code == 404:
    q_resp = session.post(f"{base_url}/sales/quotations", json=quotation_payload)

print(f"Quotation Status: {q_resp.status_code}")
print(f"Quotation Body: {q_resp.text}")
