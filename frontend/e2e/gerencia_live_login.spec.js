const { test, expect } = require('@playwright/test');
const path = require('path');

const BASE = process.env.FRONTEND_BASE || 'http://127.0.0.1:3000';
const PIN = process.env.TEST_PIN || '01011990';

test('live gerencia login via PIN pad', async ({ page }) => {
  test.setTimeout(90000);

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('input[aria-label="PIN"]', { timeout: 30000 });

  for (const digit of PIN.split('')) {
    await page.getByRole('button', { name: digit, exact: true }).click();
  }

  await page.waitForFunction(
    () => !window.location.pathname.includes('/login') && window.location.pathname !== '/',
    null,
    { timeout: 30000 }
  ).catch(async () => {
    await page.waitForURL(/\/(dashboard|sales|workbench)/, { timeout: 15000 });
  });

  const screenshotPath = path.join(__dirname, '..', 'test-results', 'gerencia-live-login.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });

  const bodyText = await page.locator('body').innerText();
  expect(bodyText.length).toBeGreaterThan(20);
  expect(bodyText.toLowerCase()).not.toContain('pin incorrecto');
});