import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.FRONTEND_BASE || 'http://127.0.0.1:3000';
const PIN = process.env.TEST_PIN || '01011990';
const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const STEP_DELAY_MS = Number(process.env.STEP_DELAY_MS || 5000);
const OUT_DIR = path.join(__dirname, '..', 'test-results', 'sales-form-reload');

fs.mkdirSync(OUT_DIR, { recursive: true });

const log = [];
const record = (step, detail, ok = true) => {
  const entry = { step, detail, ok, at: new Date().toISOString() };
  log.push(entry);
  console.log(`${ok ? 'OK' : 'FAIL'} | ${step}: ${detail}`);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

async function readFormState(page) {
  return page.evaluate(() => {
    const progress = document.querySelector('nav[aria-label="Progreso del formulario"]');
    const stepStates = progress
      ? Array.from(progress.querySelectorAll('li')).map((li) => {
          const label = li.getAttribute('aria-label') || li.textContent?.trim() || '';
          const done = Boolean(li.querySelector('.border-emerald-500'));
          const active = Boolean(li.querySelector('.border-primary'));
          return { label, done, active };
        })
      : [];

    const customerCard = Array.from(document.querySelectorAll('p')).find((p) =>
      p.textContent?.includes('Paso 1:') || p.closest('[class*="customer"]')
    );

    const customerName = Array.from(document.querySelectorAll('p')).find((p) =>
      p.querySelector('.text-emerald-700, .text-blue-700') && p.textContent && !p.textContent.includes('Paso')
    )?.textContent?.trim() || '';

    const cartHeading = Array.from(document.querySelectorAll('span, p, h3, h4')).find((el) =>
      el.textContent?.includes('Paso 4:') || el.textContent?.includes('Carrito')
    )?.textContent || '';

    const cartItems = document.querySelectorAll('[data-testid^="cart-item"], table tbody tr').length;

    return {
      stepStates,
      customerSelected: Array.from(document.querySelectorAll('button')).some((btn) =>
        btn.textContent?.includes('Cambiar')
      ),
      customerSearch: document.querySelector('input[placeholder*="Buscar por nombre"]')?.value || '',
      productSearch: document.querySelector('input[placeholder*="Buscar producto"], input[placeholder*="artículo"], input[placeholder*="SKU"]')?.value || '',
      cartItems,
      progressHtmlLength: progress?.innerHTML?.length || 0,
      customerName,
      cartHeading,
    };
  });
}

async function compareStates(before, after, label) {
  const lostCustomer = before.customerSelected && !after.customerSelected;
  const progressReset = before.progressHtmlLength > 0
    && after.progressHtmlLength > 0
    && before.progressHtmlLength !== after.progressHtmlLength
    && before.customerSelected === after.customerSelected;
  const lostSearch = (before.customerSearch && !after.customerSearch)
    || (before.productSearch && !after.productSearch);

  const issues = [];
  if (lostCustomer) issues.push('cliente deseleccionado');
  if (progressReset) issues.push('barra de pasos remontada');
  if (lostSearch) issues.push('texto de búsqueda borrado');

  record(label, issues.length ? issues.join('; ') : 'sin regresión detectada', issues.length === 0);
  return issues;
}

const browser = await chromium.launch({
  headless: true,
  executablePath: CHROME,
});

try {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await context.newPage();

  await loginGerencia(page);
  await page.goto(`${BASE}/sales`, { waitUntil: 'networkidle' });
  await sleep(STEP_DELAY_MS);

  const saleForm = page.locator('nav[aria-label="Progreso del formulario"]');
  await saleForm.waitFor({ state: 'visible', timeout: 30000 });
  record('init', 'Formulario de ventas visible');

  // Paso 1: escribir búsqueda de cliente
  const customerInput = page.locator('input[placeholder*="Buscar por nombre"]').first();
  await customerInput.click();
  await customerInput.fill('a');
  await sleep(STEP_DELAY_MS);
  let state = await readFormState(page);
  record('customer-search', `lista visible, búsqueda="${state.customerSearch}"`);

  // Abrir lista de clientes (ya visible al escribir)
  const beforeList = await readFormState(page);
  await customerInput.click();
  await sleep(STEP_DELAY_MS);
  const afterList = await readFormState(page);
  await compareStates(beforeList, afterList, 'customer-list-open');

  // Seleccionar primer cliente si hay resultados
  const firstCustomer = page.locator('[data-index="0"]').first();
  if (await firstCustomer.count()) {
    await firstCustomer.click();
    await sleep(STEP_DELAY_MS);
    state = await readFormState(page);
    record('customer-select', `cliente seleccionado=${state.customerSelected}`);
  } else {
    record('customer-select', 'sin resultados de cliente, se omite selección', false);
  }

  // Paso 2: vehículo — abrir picker
  const beforeVehicle = await readFormState(page);
  const vehicleBtn = page.getByRole('button', { name: /Producto para llevar|vehículo/i }).first();
  if (await vehicleBtn.count()) {
    await vehicleBtn.click();
    await sleep(STEP_DELAY_MS);
    const afterVehicle = await readFormState(page);
    await compareStates(beforeVehicle, afterVehicle, 'vehicle-picker-open');
  }

  // Paso 3: producto
  const productInput = page.locator('input[placeholder*="Buscar producto"], input[placeholder*="artículo"], input[placeholder*="SKU"]').first();
  if (await productInput.count()) {
    await productInput.click();
    await productInput.fill('a');
    await sleep(STEP_DELAY_MS);
    const beforeProduct = await readFormState(page);
    await productInput.click();
    await sleep(STEP_DELAY_MS);
    const afterProduct = await readFormState(page);
    await compareStates(beforeProduct, afterProduct, 'product-list-open');

    const firstProduct = page.locator('[data-index="0"]').first();
    if (await firstProduct.count()) {
      await firstProduct.click();
      await sleep(STEP_DELAY_MS);
      state = await readFormState(page);
      record('product-add', `ítems carrito=${state.cartItems}`);
    }
  }

  // Simular evento focus de ventana (como al cerrar un popover)
  const beforeFocus = await readFormState(page);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await sleep(2000);
  const afterFocus = await readFormState(page);
  await compareStates(beforeFocus, afterFocus, 'window-focus-refresh');

  const screenshotPath = path.join(OUT_DIR, `sales-form-${Date.now()}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  record('screenshot', screenshotPath);

  const reportPath = path.join(OUT_DIR, 'report.json');
  fs.writeFileSync(reportPath, JSON.stringify({ log, stepDelayMs: STEP_DELAY_MS }, null, 2));
  console.log(`Reporte: ${reportPath}`);

  const failures = log.filter((entry) => !entry.ok);
  if (failures.length) {
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}