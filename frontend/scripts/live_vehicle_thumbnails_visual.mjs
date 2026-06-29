import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.FRONTEND_BASE || 'http://127.0.0.1:3000';
const API = process.env.API_BASE || 'http://127.0.0.1:8001/api';
const PIN = process.env.TEST_PIN || '01011990';
const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT_DIR = path.join(__dirname, '..', 'test-results', 'vehicle-thumbnails');

fs.mkdirSync(OUT_DIR, { recursive: true });

const results = {
  api: {},
  ui: {},
  screenshots: [],
  errors: [],
};

async function checkApi(request) {
  const manifestRes = await request.get(`${API}/vehicle-thumbnails/manifest`);
  results.api.manifestStatus = manifestRes.status();
  const manifest = await manifestRes.json();
  results.api.typeCount = manifest.types?.length || 0;

  const slugs = manifest.types || [];
  results.api.thumbnails = {};
  for (const slug of slugs) {
    const res = await request.get(`${API}/vehicle-thumbnails/${slug}.png`);
    const body = await res.body();
    results.api.thumbnails[slug] = {
      status: res.status(),
      bytes: body.length,
      png: body[0] === 0x89 && body[1] === 0x50,
    };
  }
}

async function loginGerencia(page) {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('input[aria-label="PIN"]', { timeout: 30000 });
  for (const digit of PIN.split('')) {
    await page.getByRole('button', { name: digit, exact: true }).click();
  }
  await page.waitForURL(/\/(dashboard|sales|workbench|customers|settings|vehicles)/, { timeout: 30000 });
}

async function assertImageLoaded(page, selector, label, { visibleOnly = false } = {}) {
  const img = visibleOnly
    ? page.locator(selector).filter({ visible: true }).first()
    : page.locator(selector).first();
  await img.waitFor({ state: 'visible', timeout: 20000 });
  const metrics = await img.evaluate((el) => ({
    src: el.currentSrc || el.src,
    naturalWidth: el.naturalWidth,
    naturalHeight: el.naturalHeight,
    complete: el.complete,
  }));
  results.ui[label] = metrics;
  if (!metrics.complete || metrics.naturalWidth <= 0 || !metrics.src.includes('/api/vehicle-thumbnails/')) {
    throw new Error(`Imagen inválida para ${label}: ${JSON.stringify(metrics)}`);
  }
}

const browser = await chromium.launch({
  headless: true,
  executablePath: CHROME,
});

try {
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await context.newPage();

  await checkApi(context.request);

  await loginGerencia(page);

  await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });
  await page.getByRole('tab', { name: 'Vehículos' }).click();
  await page.getByText('Siluetas de vehículos').waitFor({ timeout: 20000 });

  for (const label of ['Hatchback', 'Sedan', 'Convertible', 'SUV', 'Cabezal']) {
    await assertImageLoaded(page, `img[alt="${label}"]`, `settings_${label}`);
  }

  const settingsShot = path.join(OUT_DIR, 'settings-siluetas-grid.png');
  await page.locator('text=Siluetas de vehículos').locator('xpath=ancestor::div[contains(@class,"rounded-lg")][1]').screenshot({ path: settingsShot }).catch(async () => {
    await page.screenshot({ path: settingsShot, fullPage: true });
  });
  results.screenshots.push(settingsShot);

  // Use workbench tabs to avoid nginx trailing-slash redirect dropping :3000 on /vehicles.
  await page.goto(`${BASE}/workbench?tab=vehicles`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await assertImageLoaded(page, 'img[alt*="TOYOTA"], img[alt*="KIA"], img[alt*="HYUNDAI"], img[alt*="Vehículo"]', 'vehicles_card');
  const vehiclesShot = path.join(OUT_DIR, 'vehicles-page-cards.png');
  await page.screenshot({ path: vehiclesShot, fullPage: true });
  results.screenshots.push(vehiclesShot);

  await page.goto(`${BASE}/workbench?tab=sales`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await assertImageLoaded(page, 'img[src*="/api/vehicle-thumbnails/"]', 'sales_card', { visibleOnly: true });
  const salesShot = path.join(OUT_DIR, 'sales-page-cards.png');
  await page.screenshot({ path: salesShot, fullPage: true });
  results.screenshots.push(salesShot);

  const reportPath = path.join(OUT_DIR, 'visual-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2), 'utf8');

  console.log('VEHICLE_THUMBNAILS_VISUAL_OK');
  console.log('report:', reportPath);
  for (const shot of results.screenshots) console.log('screenshot:', shot);
  console.log(JSON.stringify(results, null, 2));
} catch (error) {
  results.errors.push(String(error?.message || error));
  const failPath = path.join(OUT_DIR, 'visual-report-failed.json');
  fs.writeFileSync(failPath, JSON.stringify(results, null, 2), 'utf8');
  console.error('VEHICLE_THUMBNAILS_VISUAL_FAIL');
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
}