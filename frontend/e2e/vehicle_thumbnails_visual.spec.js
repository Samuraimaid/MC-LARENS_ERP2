const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const BASE = process.env.FRONTEND_BASE || 'http://127.0.0.1:3000';
const API = process.env.API_BASE || 'http://127.0.0.1:8001/api';
const PIN = process.env.TEST_PIN || '01011990';
const OUT_DIR = path.join(__dirname, '..', 'test-results', 'vehicle-thumbnails');

async function loginGerencia(page) {
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
    await page.waitForURL(/\/(dashboard|sales|workbench|vehicles|settings)/, { timeout: 15000 });
  });
}

test.describe('Vehicle thumbnails visual verification', () => {
  test.beforeAll(() => {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  });

  test('API manifest and PNG assets load', async ({ request }) => {
    const manifestRes = await request.get(`${API}/vehicle-thumbnails/manifest`);
    expect(manifestRes.ok()).toBeTruthy();
    const manifest = await manifestRes.json();
    expect(manifest.types).toHaveLength(11);
    expect(manifest.assets?.sedan?.url).toContain('/vehicle-thumbnails/sedan.png');

    const slugs = [
      'hatchback',
      'sedan',
      'convertible',
      'suv',
      'station-wagon',
      'camioneta-1-cabina',
      'camioneta-cabina-y-media',
      'microbus-carga',
      'microbus-pasajeros',
      'camion-carga',
      'cabezal',
    ];

    for (const slug of slugs) {
      const imgRes = await request.get(`${API}/vehicle-thumbnails/${slug}.png`);
      expect(imgRes.ok(), `thumbnail ${slug}`).toBeTruthy();
      const body = await imgRes.body();
      expect(body.byteLength).toBeGreaterThan(2000);
      expect(body[0]).toBe(0x89);
      expect(body[1]).toBe(0x50);
    }
  });

  test('Settings siluetas grid renders with images', async ({ page }) => {
    test.setTimeout(120000);
    await loginGerencia(page);

    await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });
    await page.getByRole('tab', { name: 'Vehículos' }).click();
    await expect(page.getByText('Siluetas de vehículos')).toBeVisible({ timeout: 15000 });

    const cards = page.locator('img[alt="Hatchback"], img[alt="Sedan"], img[alt="SUV"], img[alt="Cabezal"]');
    await expect(cards.first()).toBeVisible({ timeout: 15000 });

    const samples = ['Hatchback', 'Sedan', 'Convertible', 'SUV', 'Cabezal', 'Camion de Carga'];
    for (const label of samples) {
      const img = page.locator(`img[alt="${label}"]`).first();
      await expect(img).toBeVisible();
      const metrics = await img.evaluate((el) => ({
        src: el.currentSrc || el.src,
        naturalWidth: el.naturalWidth,
        naturalHeight: el.naturalHeight,
        complete: el.complete,
      }));
      expect(metrics.complete).toBeTruthy();
      expect(metrics.naturalWidth).toBeGreaterThan(0);
      expect(metrics.naturalHeight).toBeGreaterThan(0);
      expect(metrics.src).toContain('/api/vehicle-thumbnails/');
    }

    await page.locator('text=Siluetas de vehículos').locator('..').locator('..').screenshot({
      path: path.join(OUT_DIR, 'settings-siluetas-grid.png'),
    });
    await page.screenshot({ path: path.join(OUT_DIR, 'settings-vehicles-tab-full.png'), fullPage: true });
  });

  test('Vehicles page cards show API thumbnails', async ({ page }) => {
    test.setTimeout(120000);
    await loginGerencia(page);

    await page.goto(`${BASE}/workbench?tab=vehicles`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    const vehicleImg = page.locator('img[alt*="TOYOTA"], img[alt*="KIA"], img[alt*="HYUNDAI"], img[alt*="Vehículo"]').first();
    await expect(vehicleImg).toBeVisible({ timeout: 20000 });

    const info = await vehicleImg.evaluate((el) => ({
      src: el.currentSrc || el.src,
      naturalWidth: el.naturalWidth,
      naturalHeight: el.naturalHeight,
    }));
    expect(info.naturalWidth).toBeGreaterThan(0);
    expect(info.src).toMatch(/vehicle-thumbnails|\.png/);

    await page.screenshot({ path: path.join(OUT_DIR, 'vehicles-page-cards.png'), fullPage: true });
  });

  test('Sales page cards show API thumbnails', async ({ page }) => {
    test.setTimeout(120000);
    await loginGerencia(page);

    await page.goto(`${BASE}/workbench?tab=sales`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    const saleImg = page.locator('img[src*="/api/vehicle-thumbnails/"]').filter({ visible: true }).first();
    await expect(saleImg).toBeVisible({ timeout: 25000 });

    const info = await saleImg.evaluate((el) => ({
      src: el.currentSrc || el.src,
      naturalWidth: el.naturalWidth,
      naturalHeight: el.naturalHeight,
    }));
    expect(info.naturalWidth).toBeGreaterThan(0);
    expect(info.src).toContain('/api/vehicle-thumbnails/');

    await page.screenshot({ path: path.join(OUT_DIR, 'sales-page-cards.png'), fullPage: true });
  });
});