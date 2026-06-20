import { chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.FRONTEND_BASE || 'http://localhost:3000';
const PIN = process.env.TEST_PIN || '01011990';
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

const browser = await chromium.launch({
  headless: true,
  executablePath: CHROME,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

try {
  await loginWithPin(page);
  await page.goto(`${BASE}/cashier`, { waitUntil: 'networkidle' });

  const openBtn = page.getByTestId('cashier-open-session-btn');
  if (await openBtn.isVisible().catch(() => false)) {
    await openBtn.click();
    await page.waitForTimeout(2500);
  }

  await page.screenshot({ path: path.join(OUT_DIR, 'cashier-page-overview.png'), fullPage: true });

  const cards = page.locator('button').filter({ has: page.locator('text=En caja hace') });
  const cardCount = await cards.count();
  console.log('cashier_cards:', cardCount);

  if (cardCount > 0) {
    await cards.first().click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT_DIR, 'cashier-card-selected.png'), fullPage: true });

    const breakdown = page.locator('text=Desglose legal');
    console.log('legal_breakdown_visible:', await breakdown.isVisible().catch(() => false));

    const cardText = await cards.first().innerText().catch(() => '');
    console.log('first_card_text:', cardText.replace(/\s+/g, ' ').slice(0, 280));
    console.log('plate_in_card:', /·\s*[A-Z0-9]{3,}/i.test(cardText));

    const urgentBorder = page.locator('button.border-rose-400, button.border-rose-500');
    console.log('urgent_cards:', await urgentBorder.count());
  }

  const bodyText = await page.locator('[data-testid="cashier-page"]').innerText().catch(() => '');
  console.log('BROWSER_CASHIER_OK');
  console.log('url:', page.url());
  console.log('body_snippet:', bodyText.slice(0, 400).replace(/\s+/g, ' '));
} catch (error) {
  await page.screenshot({ path: path.join(OUT_DIR, 'cashier-page-error.png'), fullPage: true });
  console.error('BROWSER_CASHIER_FAIL', error?.message || error);
  process.exitCode = 1;
} finally {
  await browser.close();
}