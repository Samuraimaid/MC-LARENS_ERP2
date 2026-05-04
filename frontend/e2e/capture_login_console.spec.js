const { test, expect } = require('@playwright/test');
const fs = require('fs');

const BASE = process.env.FRONTEND_BASE || 'http://127.0.0.1:3000';
const BACKEND = process.env.BACKEND_BASE || 'http://127.0.0.1:8001';

test('capture login console and API logs', async ({ page, request }) => {
  const logs = [];
  page.on('console', (msg) => {
    try {
      logs.push({ type: 'console', text: msg.text(), location: msg.location() });
    } catch (e) {}
  });

  // capture network responses for /api/auth/pin/login
  const net = [];
  page.on('response', async (resp) => {
    try {
      const url = resp.url();
      if (url.includes('/api/auth/pin/login')) {
        let body = '';
        try { body = await resp.text(); } catch (e) { body = '<no-body>'; }
        net.push({ url, status: resp.status(), body });
      }
    } catch (e) {}
  });

  // Create admin session and a test PIN user via backend request
  const adminResp = await request.post(`${BACKEND}/api/test/create-session`);
  const adminJson = await adminResp.json();
  const sessionToken = adminJson.session_token;

  const pin = String(Math.floor(Math.random() * 9000) + 1000);
  const loginPin = `${pin}${pin}`;
  const unique = `E2E_Debug_${Date.now() % 100000}`;
  const createResp = await request.post(`${BACKEND}/api/users/pin`, {
    headers: { Cookie: `session_token=${sessionToken}`, 'Content-Type': 'application/json' },
    data: {
      name: unique,
      last_name: 'E2E',
      phone: '5555-3333',
      role: 'ventas',
      branch_id: 'branch_test',
      pin,
      login_pin: loginPin,
    },
  });
  expect(createResp.ok()).toBeTruthy();
  const created = await createResp.json();
  const userId = created.user_id;

  await page.goto(`${BASE}/login`, { waitUntil: 'load' });

  // Ensure the page is loaded
  await page.waitForSelector('input[aria-label="PIN"]');

  // Use in-page fetch to perform login attempts so the browser sees the exact responses
  const MAX_ATTEMPTS = 5;
  await page.evaluate(async ({ userId, maxAttempts }) => {
    for (let i = 1; i <= maxAttempts; i++) {
      try {
        const resp = await fetch('/api/auth/pin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId, pin: '00000000' }),
        });
        const text = await resp.text();
        console.log('FETCH_LOGIN_ATTEMPT', { attempt: i, status: resp.status, body: text });
      } catch (e) {
        console.warn('FETCH_ERR', e && e.message);
      }
      // short pause
      await new Promise((r) => setTimeout(r, 300));
    }
  }, { userId, maxAttempts: MAX_ATTEMPTS });

  // Grab last axios instrumentation log if present
  let lastApiLog = await page.evaluate(() => {
    try { return window.__LAST_API_LOG__ || null; } catch (e) { return null; }
  });

  const out = { console: logs, network: net, lastApiLog };
  const outPath = './test-artifacts/login_console_capture.json';
  try {
    fs.mkdirSync('./test-artifacts', { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  } catch (e) {
    console.warn('Failed to write artifacts', e);
  }

  console.log('Wrote capture to', outPath);

  // cleanup created user
  await request.delete(`${BACKEND}/api/users/pin/${userId}`, { headers: { Cookie: `session_token=${sessionToken}` } });

  // basic assertions
  expect(net.length).toBeGreaterThan(0);
});
