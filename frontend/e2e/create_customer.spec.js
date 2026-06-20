const { test, expect } = require('@playwright/test');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3000';

// Uses seeded Xinon login PIN (DEFAULT_LOGIN_PIN_USER_PIN env or 01011990)
const XINON_PIN = process.env.DEFAULT_LOGIN_PIN_USER_PIN || '01011990';

test('API: login with PIN then create customer', async ({ request }) => {
  // get PIN users
  const usersRes = await request.get(`${BASE}/api/auth/pin/users`);
  expect(usersRes.ok()).toBeTruthy();
  const users = await usersRes.json();
  expect(Array.isArray(users)).toBeTruthy();
  const xinon = users.find(u => u.name === 'Xinon') || users[0];
  expect(xinon).toBeTruthy();

  // login with pin for selected user
  const login = await request.post(`${BASE}/api/auth/pin/login`, { data: { user_id: xinon.user_id, pin: XINON_PIN } });
  expect(login.ok()).toBeTruthy();

  // create customer
  const customerData = {
    name: `E2E Test ${Date.now()}`,
    first_name: 'E2E',
    last_name: 'Test',
    customer_type: 'natural',
    email: `e2e+${Date.now()}@example.com`,
    phone: '+505-12345678',
    address: 'Test address',
    credit_limit: 0
  };

  const create = await request.post(`${BASE}/api/customers`, { data: customerData });
  expect(create.ok()).toBeTruthy();
  const created = await create.json();
  expect(created.customer_id).toBeTruthy();

  // fetch customers and ensure created present
  const list = await request.get(`${BASE}/api/customers`);
  expect(list.ok()).toBeTruthy();
  const customers = await list.json();
  const found = customers.find(c => c.customer_id === created.customer_id || c.email === customerData.email);
  expect(found).toBeTruthy();
});
