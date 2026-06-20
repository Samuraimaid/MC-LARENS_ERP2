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
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForSelector('input[aria-label="PIN"]', { timeout: 30000 });

for (const digit of PIN.split('')) {
  await page.getByRole('button', { name: digit, exact: true }).click();
}

await page.waitForURL(/\/(dashboard|sales|workbench|customers)/, { timeout: 30000 });
const screenshotPath = path.join(__dirname, '..', 'test-results', 'gerencia-live-login.png');
await page.screenshot({ path: screenshotPath, fullPage: true });
const title = await page.title();
const url = page.url();
console.log('BROWSER_LOGIN_OK');
console.log('title:', title);
console.log('url:', url);
console.log('screenshot:', screenshotPath);
await browser.close();