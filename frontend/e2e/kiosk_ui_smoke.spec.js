const { test, expect } = require('@playwright/test');

const FRONTEND = process.env.FRONTEND_BASE || 'http://127.0.0.1:3000';
const BACKEND = process.env.BACKEND_BASE || 'http://127.0.0.1:8001';

test('Kiosk UI smoke: logo, 12h clock and PIN punch flow', async ({ page, request }) => {
  const adminResp = await request.post(`${BACKEND}/api/test/create-session`, { timeout: 30000 });
  expect(adminResp.ok()).toBeTruthy();
  const adminJson = await adminResp.json();
  const sessionToken = adminJson.session_token;

  const pin = String(Math.floor(Math.random() * 9000) + 1000);
  const loginPin = `${pin}${pin}`;
  const unique = `E2E_KIOSK_UI_${Date.now() % 100000}`;

  const settingsResp = await request.get(`${BACKEND}/api/hr/attendance/settings`, {
    headers: { Cookie: `session_token=${sessionToken}` },
    timeout: 30000,
  });
  expect(settingsResp.ok()).toBeTruthy();
  const settingsJson = await settingsResp.json();
  const previousGlobal = settingsJson.global || {};

  const tempSettings = {
    scope: 'global',
    branch_id: null,
    settings: {
      ...previousGlobal,
      time_format: '12h',
      kiosk_theme_mode: 'system',
      entry_start: '00:00',
      entry_tolerance_minutes: 1439,
      lunch_out_start: '00:00',
      lunch_out_end: '23:59',
      lunch_break_minutes: 1,
      weekday_shift_end: '00:00',
      saturday_shift_end: '00:00',
      anti_double_touch_seconds: 0,
    },
  };

  const setTemp = await request.put(`${BACKEND}/api/hr/attendance/settings`, {
    headers: { Cookie: `session_token=${sessionToken}`, 'Content-Type': 'application/json' },
    data: tempSettings,
    timeout: 30000,
  });
  expect(setTemp.ok()).toBeTruthy();

  let userId = null;
  try {
    const createResp = await request.post(`${BACKEND}/api/users/pin`, {
      headers: { Cookie: `session_token=${sessionToken}`, 'Content-Type': 'application/json' },
      data: {
        name: unique,
        last_name: 'KIOSK',
        phone: '5555-4444',
        role: 'recursos_humanos',
        branch_id: 'branch_test',
        pin,
        login_pin: loginPin,
      },
      timeout: 30000,
    });
    expect(createResp.ok()).toBeTruthy();
    const created = await createResp.json();
    userId = created.user_id;
    expect(userId).toBeTruthy();

    const punchResponses = [];
    page.on('response', async (resp) => {
      try {
        if (resp.url().includes('/api/hr/timeclock/kiosk-punch')) {
          const body = await resp.json();
          punchResponses.push({ status: resp.status(), body });
        }
      } catch (_) {
      }
    });

    await page.goto(`${FRONTEND}/attendance-clock`, { waitUntil: 'domcontentloaded', timeout: 30000 });

    await expect(page.locator('img[alt="Marca de agua empresa"]')).toBeVisible();
    await expect(page.locator('text=PIN (4 dígitos)')).toBeVisible();

    const clockText = await page.locator('[data-testid="attendance-clock-page"] .font-mono').first().innerText();
    expect(clockText).toMatch(/\d{2}:\d{2}:\d{2}(\s?(AM|PM))?/i);

    for (const digit of pin.split('')) {
      await page.click(`button:has-text("${digit}")`);
      await page.waitForTimeout(50);
    }

    await expect.poll(() => punchResponses.length, { timeout: 15000 }).toBeGreaterThan(0);
    expect(punchResponses[0].status).toBe(200);
    expect(['clock_in', 'lunch_out', 'lunch_in', 'clock_out']).toContain(punchResponses[0].body?.event_type);
  } finally {
    await request.put(`${BACKEND}/api/hr/attendance/settings`, {
      headers: { Cookie: `session_token=${sessionToken}`, 'Content-Type': 'application/json' },
      data: { scope: 'global', branch_id: null, settings: previousGlobal },
      timeout: 30000,
    }).catch(() => {});

    if (userId) {
      await request.delete(`${BACKEND}/api/users/pin/${userId}`, {
        headers: { Cookie: `session_token=${sessionToken}` },
        timeout: 30000,
      }).catch(() => {});
    }
  }
});
