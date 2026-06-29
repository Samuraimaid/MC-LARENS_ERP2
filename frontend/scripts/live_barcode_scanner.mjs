import { chromium, devices } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.FRONTEND_BASE || 'https://127.0.0.1:3443';
const PIN = process.env.TEST_PIN || '01011990';
const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT_DIR = path.join(__dirname, '..', 'test-results', 'barcode-scanner');

fs.mkdirSync(OUT_DIR, { recursive: true });

const log = [];
const record = (step, detail, ok = true) => {
  log.push({ step, detail, ok, at: new Date().toISOString() });
  console.log(`${ok ? 'OK' : 'FAIL'} | ${step}: ${detail}`);
};

async function loginGerencia(page) {
  await page.goto(`${BASE}/sales`, { waitUntil: 'networkidle' });
  const pinInput = page.locator('input[aria-label="PIN"]');
  if (await pinInput.count()) {
    for (const digit of PIN.split('')) {
      await page.getByRole('button', { name: digit, exact: true }).click();
    }
    await page.waitForURL(/\/(dashboard|sales|workbench|customers|settings|vehicles)/, { timeout: 30000 });
  }
}

async function prepareSaleFlow(page) {
  await page.waitForSelector('nav[aria-label="Progreso del formulario"]', { timeout: 30000 });

  const customerInput = page.locator('input[placeholder*="Buscar por nombre"]').first();
  await customerInput.fill('a');
  await page.waitForTimeout(500);
  const firstCustomer = page.locator('[data-index="0"]').first();
  if (await firstCustomer.count()) {
    await firstCustomer.click();
    await page.waitForTimeout(800);
  }

  const carryout = page.getByRole('button', { name: /Producto para llevar/i }).filter({ hasNot: page.locator(':disabled') }).first();
  if (await carryout.count()) {
    await carryout.click({ timeout: 10000 });
    await page.waitForTimeout(500);
  }

  const productInput = page.locator('input[placeholder*="Buscar por nombre, SKU"]').first();
  await productInput.waitFor({ state: 'visible', timeout: 15000 });
}

const browser = await chromium.launch({
  headless: true,
  executablePath: CHROME,
  args: [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
  ],
});

try {
  const contexts = [
    {
      label: 'desktop-https',
      context: await browser.newContext({
        ignoreHTTPSErrors: true,
        permissions: ['camera'],
        viewport: { width: 1400, height: 900 },
      }),
    },
    {
      label: 'pixel7-mobile-https',
      context: await browser.newContext({
        ...devices['Pixel 7'],
        ignoreHTTPSErrors: true,
        permissions: ['camera'],
      }),
    },
  ];

  for (const entry of contexts) {
    const page = await entry.context.newPage();
    await loginGerencia(page);
    await prepareSaleFlow(page);

    const scanButton = page.getByRole('button', { name: /Escanear código de barras o QR/i });
    await scanButton.waitFor({ state: 'visible', timeout: 20000 });
    await scanButton.click();

    const dialog = page.getByRole('dialog');
    await dialog.waitFor({ state: 'visible', timeout: 10000 });

    const activateBtn = page.getByRole('button', { name: /^Activar cámara$/i });
    const videoLocator = page.locator('video').first();
    const isMobileContext = entry.label.includes('mobile');

    if (isMobileContext) {
      await activateBtn.waitFor({ state: 'visible', timeout: 10000 });
      await activateBtn.click();
      await page.waitForTimeout(3500);
    } else {
      const cameraReady = await Promise.race([
        videoLocator.waitFor({ state: 'visible', timeout: 12000 }).then(() => true).catch(() => false),
        page.locator('text=/La cámara requiere HTTPS|Permiso de cámara|No se pudo iniciar|se interrumpió/i')
          .first()
          .waitFor({ state: 'visible', timeout: 12000 })
          .then(() => false)
          .catch(() => false),
      ]);

      if (!cameraReady && await activateBtn.isVisible().catch(() => false)) {
        await activateBtn.click();
        await page.waitForTimeout(3000);
      } else {
        await page.waitForTimeout(1500);
      }
    }

    const errorText = await page.locator('text=/La cámara requiere HTTPS|Permiso de cámara|No se pudo iniciar|se interrumpió/i').first().textContent().catch(() => '');
    const videoVisible = await videoLocator.isVisible().catch(() => false);
    const videoWidth = await videoLocator.evaluate((el) => el.videoWidth || 0).catch(() => 0);

    const shot = path.join(OUT_DIR, `${entry.label}-${Date.now()}.png`);
    await page.screenshot({ path: shot, fullPage: true });

    if (errorText) {
      record(`${entry.label}-error`, errorText.trim(), false);
    } else if (videoVisible && videoWidth > 0) {
      record(`${entry.label}-camera`, `video activo ${videoWidth}px, screenshot=${shot}`);
    } else {
      record(`${entry.label}-camera`, `sin error visible; video=${videoVisible}; screenshot=${shot}`, !errorText);
    }

    await entry.context.close();
  }

  fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(log, null, 2));
  const failures = log.filter((item) => !item.ok);
  if (failures.length) process.exitCode = 1;
} finally {
  await browser.close();
}