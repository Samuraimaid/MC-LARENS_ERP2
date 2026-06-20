const { test, expect } = require('@playwright/test');

const BASE = process.env.FRONTEND_BASE || 'http://127.0.0.1:3000';

test('reset session button turns destructive on login error', async ({ page }) => {
  const invalidPin = '99999999';

  await page.goto(`${BASE}/login`, { waitUntil: 'load' });
  await page.waitForSelector('[data-testid="pin-reset-session"]', { timeout: 15000 });

  const initialClass = await page.getAttribute('[data-testid="pin-reset-session"]', 'class');
  expect(initialClass || '').not.toMatch(/bg-destructive|text-destructive-foreground/);

  for (const digit of invalidPin.split('')) {
    await page.click(`[data-testid="pin-key-${digit}"]`);
  }

  await expect.poll(async () => {
    const cls = await page.getAttribute('[data-testid="pin-reset-session"]', 'class');
    return /bg-destructive|text-destructive-foreground/.test(cls || '');
  }, { timeout: 30000 }).toBeTruthy();
});
