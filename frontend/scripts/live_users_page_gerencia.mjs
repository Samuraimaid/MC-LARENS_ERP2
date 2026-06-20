import { chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.FRONTEND_BASE || 'http://127.0.0.1:3000';
const PIN = process.env.TEST_PIN || '01011990';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const browser = await chromium.launch({
  headless: true,
  executablePath: CHROME,
});
const page = await browser.newPage();

const usersResponses = [];
page.on('response', async (response) => {
  const url = response.url();
  if (url.includes('/api/users')) {
    let body = '';
    try {
      body = (await response.text()).slice(0, 300);
    } catch (_) {
      body = '<unreadable>';
    }
    usersResponses.push({ url, status: response.status(), body });
  }
});

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForSelector('input[aria-label="PIN"]', { timeout: 30000 });
for (const digit of PIN.split('')) {
  await page.getByRole('button', { name: digit, exact: true }).click();
}
await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30000 });

await page.goto(`${BASE}/users`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

const bodyText = await page.locator('body').innerText();
const screenshotPath = path.join(__dirname, '..', 'test-results', 'gerencia-users-page.png');
await page.screenshot({ path: screenshotPath, fullPage: true });

const sidebarHasUsers = bodyText.includes('Usuarios');
const pageHasTitle = bodyText.includes('Gestión de Usuarios');
const emptyState = bodyText.includes('No hay usuarios PIN creados');
const pinCountMatch = bodyText.match(/Usuarios PIN \((\d+)\)/);
const tableRows = await page.locator('[data-testid^="pin-user-"]').count();

console.log('url:', page.url());
console.log('sidebarHasUsers:', sidebarHasUsers);
console.log('pageHasTitle:', pageHasTitle);
console.log('emptyState:', emptyState);
console.log('pinTabCount:', pinCountMatch ? pinCountMatch[1] : 'n/a');
console.log('tableRows:', tableRows);
console.log('usersResponses:', JSON.stringify(usersResponses, null, 2));
console.log('screenshot:', screenshotPath);

await browser.close();
if (!pageHasTitle || emptyState || tableRows === 0) {
  process.exitCode = 1;
}