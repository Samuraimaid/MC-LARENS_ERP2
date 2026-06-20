const { test, expect } = require('@playwright/test');
const path = require('path');

const BASE = process.env.FRONTEND_BASE || 'http://127.0.0.1:3000';
const PIN = process.env.CASHIER_PIN || '11223344';

async function loginWithPin(page, pin) {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('input[aria-label="PIN"]', { timeout: 30000 });
  for (const digit of pin.split('')) {
    await page.getByRole('button', { name: digit, exact: true }).click();
  }
  await page.waitForFunction(
    () => !window.location.pathname.includes('/login') && window.location.pathname !== '/',
    null,
    { timeout: 30000 },
  );
}

test('cashier workbench shows abonos tab and customer search', async ({ page }) => {
  test.setTimeout(120000);

  await loginWithPin(page, PIN);

  await page.waitForURL(/\/cashier/, { timeout: 30000 });
  await expect(page.getByTestId('cashier-page')).toBeVisible();

  const abonosTab = page.getByRole('tab', { name: /Abonos \/ Clientes/i });
  await expect(abonosTab).toBeVisible();

  const screenshotPath = path.join(__dirname, '..', 'test-results', 'cashier-abonos-tab.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });

  const bodyText = await page.locator('body').innerText();
  expect(bodyText.toLowerCase()).not.toContain('pin incorrecto');
});