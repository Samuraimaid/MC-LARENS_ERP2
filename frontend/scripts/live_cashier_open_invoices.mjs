import { chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.FRONTEND_BASE || 'http://localhost:3000';
const PIN = process.env.TEST_PIN || '11223344';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT_DIR = path.join(__dirname, '..', 'test-results');

async function loginWithPin(page) {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('input[aria-label="PIN"]', { timeout: 30000 });
  for (const digit of PIN.split('')) {
    await page.getByRole('button', { name: digit, exact: true }).click();
  }
  await page.waitForURL(/\/(dashboard|sales|workbench|customers|cashier)/, { timeout: 30000 });
}

const browser = await chromium.launch({ headless: true, executablePath: CHROME });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

try {
  await loginWithPin(page);
  await page.goto(`${BASE}/cashier`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(OUT_DIR, 'cashier-round2-overview.png'), fullPage: true });

  const openTab = page.getByRole('tab', { name: /Facturas abiertas/i });
  const closedTab = page.getByRole('tab', { name: /Facturas cerradas/i });
  const openText = await openTab.innerText().catch(() => '');
  const closedVisible = await closedTab.isVisible().catch(() => false);
  console.log('open_tab:', openText.replace(/\s+/g, ' '));
  console.log('closed_tab_visible:', closedVisible);

  if (closedVisible) {
    await closedTab.click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(OUT_DIR, 'cashier-round2-closed.png'), fullPage: true });
    const cards = page.locator('button').filter({ has: page.locator('text=En caja hace') });
    console.log('closed_cards:', await cards.count());
  }

  const sidebar = page.locator('[data-testid="sidebar"], nav').first();
  console.log('sidebar_visible:', await sidebar.isVisible().catch(() => false));
  console.log('BROWSER_CASHIER_ROUND2_OK');
} catch (error) {
  await page.screenshot({ path: path.join(OUT_DIR, 'cashier-round2-error.png'), fullPage: true });
  console.error('BROWSER_CASHIER_ROUND2_FAIL', error?.message || error);
  process.exitCode = 1;
} finally {
  await browser.close();
}