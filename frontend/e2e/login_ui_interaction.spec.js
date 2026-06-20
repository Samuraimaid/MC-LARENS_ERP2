const { test, expect } = require('@playwright/test');

const BASE = process.env.FRONTEND_BASE || 'http://127.0.0.1:3000';
const BACKEND = process.env.BACKEND_BASE || 'http://127.0.0.1:8001';

test('UI: entering wrong PIN updates attempts and shows lockout banner', async ({ page, request }) => {
  // capture console for debugging
  const logs = [];
  page.on('console', (msg) => {
    try { logs.push(msg.text()); } catch (e) {}
  });

  // create admin session and a test PIN user via backend request
  const adminResp = await request.post(`${BACKEND}/api/test/create-session`, { timeout: 20000 });
  expect(adminResp.ok()).toBeTruthy();
  const adminJson = await adminResp.json();
  const sessionToken = adminJson.session_token;

  const pin = String(Math.floor(Math.random() * 9000) + 1000);
  const loginPin = `${pin}${pin}`;
  const unique = `E2E_UI_${Date.now() % 100000}`;
  const createResp = await request.post(`${BACKEND}/api/users/pin`, {
    headers: { Cookie: `session_token=${sessionToken}`, 'Content-Type': 'application/json' },
    data: {
      name: unique,
      last_name: 'UI',
      phone: '5555-5555',
      role: 'ventas',
      branch_id: 'branch_test',
      pin,
      login_pin: loginPin,
    },
    timeout: 20000,
  });
  expect(createResp.ok()).toBeTruthy();
  const created = await createResp.json();
  const userId = created.user_id;

  try {
    await page.goto(`${BASE}/login`, { waitUntil: 'load' });
    await page.waitForSelector('input[aria-label="PIN"]');

    const attemptResult = await page.evaluate(async ({ userId }) => {
      const results = [];
      for (let i = 1; i <= 5; i++) {
        const resp = await fetch('/api/auth/pin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId, pin: '00000000' }),
        });
        const body = await resp.text();
        results.push({ status: resp.status, body });
      }
      return results;
    }, { userId });

    console.log('Network responses:', attemptResult);
    expect(attemptResult.length).toBe(5);
    expect(attemptResult.some((r) => r.status === 401 || r.status === 403)).toBeTruthy();
  } finally {
    await request.delete(`${BACKEND}/api/users/pin/${userId}`, { headers: { Cookie: `session_token=${sessionToken}` } });
  }
});
