const { test, expect } = require('@playwright/test');

const BASE = process.env.BACKEND_URL || 'http://localhost:8002';

test('PIN API smoke: create user, login, theme and lockout', async ({ request }) => {
  // Create admin test session
  const admin = await request.post(`${BASE}/api/test/create-session`);
  expect(admin.ok()).toBeTruthy();
  const adminData = await admin.json();
  const sessionToken = adminData.session_token;
  expect(sessionToken).toBeTruthy();

  // Create PIN user
  const attendancePin = String(Math.floor(Math.random() * 9000) + 1000);
  const loginPin = String(Math.floor(Math.random() * 90000000) + 10000000);
  const unique = `E2E_Playwright_${Date.now() % 100000}`;
  const create = await request.post(`${BASE}/api/users/pin`, {
    headers: { 'Content-Type': 'application/json', Cookie: `session_token=${sessionToken}` },
    data: {
      name: unique,
      last_name: 'Playwright',
      phone: '5555-6666',
      role: 'ventas',
      branch_id: 'branch_test',
      pin: attendancePin,
      login_pin: loginPin,
    },
  });
  expect(create.ok()).toBeTruthy();
  const created = await create.json();
  const userId = created.user_id || created.id || created._id;
  expect(userId).toBeTruthy();

  // Attempt correct login via API (include user_id like the existing smoke script)
  const login = await request.post(`${BASE}/api/auth/pin/login`, {
    headers: { 'Content-Type': 'application/json' },
    data: { user_id: userId, pin: loginPin },
  });
  expect(login.ok()).toBeTruthy();
  const loginData = await login.json();
  expect(loginData).toBeTruthy();
  const hasUserShape = Boolean(loginData.user_id || loginData.user?.user_id || loginData.user);
  expect(hasUserShape).toBeTruthy();

  // Now test failed attempts and lockout behaviour (backend policy: 5 attempts)
  const wrongPin = '00000000';
  const MAX_ATTEMPTS = 5;
  for (let i = 1; i <= MAX_ATTEMPTS; i++) {
    const r = await request.post(`${BASE}/api/auth/pin/login`, { data: { user_id: userId, pin: wrongPin } });
    if (i < MAX_ATTEMPTS) {
      // Expect unauthorized until lockout threshold
      expect([401, 422]).toContain(r.status());
      const body = await r.json().catch(() => ({}));
      // If server returns remaining attempts, it should be numeric
      if (body?.detail?.remaining_attempts !== undefined) {
        expect(typeof body.detail.remaining_attempts).toBe('number');
      }
    } else {
      // On the final allowed attempt the backend should enforce lockout (403)
      expect(r.status()).toBe(403);
    }
  }

  // Cleanup: delete created user using admin session
  const del = await request.delete(`${BASE}/api/users/pin/${userId}`, {
    headers: { Cookie: `session_token=${sessionToken}` },
  });
  expect(del.ok()).toBeTruthy();
});
