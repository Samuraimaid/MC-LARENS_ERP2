import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.FRONTEND_BASE || 'http://127.0.0.1:3000';
const PIN = process.env.TEST_PIN || '01011990';
const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT_DIR = path.join(__dirname, '..', 'test-results', 'fulfillment-step2');

fs.mkdirSync(OUT_DIR, { recursive: true });

const results = [];
const record = (step, detail, ok = true) => {
  results.push({ step, detail, ok, at: new Date().toISOString() });
  console.log(`${ok ? 'OK' : 'FAIL'} | ${step}: ${detail}`);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function loginGerencia(page) {
  await page.goto(`${BASE}/workbench?tab=sales`, { waitUntil: 'commit', timeout: 60000 });
  const pinInput = page.locator('input[aria-label="PIN"]');
  await pinInput.waitFor({ state: 'visible', timeout: 45000 });
  for (const digit of PIN.split('')) {
    await page.getByRole('button', { name: digit, exact: true }).click();
  }
  await page.waitForURL(/\/(dashboard|sales|workbench|customers|settings|vehicles)/, { timeout: 45000 });
  if (!page.url().includes('/workbench')) {
    await page.goto(`${BASE}/workbench?tab=sales`, { waitUntil: 'commit', timeout: 60000 });
  }
}

async function resetSaleDrafts(page) {
  await page.evaluate(() => {
    const keys = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && (key.startsWith('draft_sale_') || key.includes('draft_sale_v1_'))) {
        keys.push(key);
      }
    }
    keys.forEach((key) => window.localStorage.removeItem(key));
  });
  await page.goto(`${BASE}/workbench?tab=sales`, { waitUntil: 'commit', timeout: 60000 });
  await page.waitForSelector('nav[aria-label="Progreso del formulario"]', { timeout: 45000 });
}

async function ensureSaleFormReady(page) {
  await page.locator('input[placeholder*="Buscar por nombre, teléfono"], input[placeholder*="Buscar por nombre, SKU"]')
    .first()
    .waitFor({ state: 'visible', timeout: 45000 });
}

async function selectFirstCustomer(page) {
  const customerInput = page.locator('input[placeholder*="Buscar por nombre, teléfono"]').first();
  const customerAlreadySelected = !(await customerInput.isVisible().catch(() => true))
    && (await page.getByText('Primero selecciona un cliente').count()) === 0;
  if (customerAlreadySelected) {
    return;
  }
  const inputVisible = await customerInput.isVisible().catch(() => false);
  if (!inputVisible) {
    const cambiarCliente = page.getByRole('button', { name: /^Cambiar$/i }).first();
    if (await cambiarCliente.count()) {
      await cambiarCliente.click();
      await sleep(500);
    }
  }
  await customerInput.waitFor({ state: 'visible', timeout: 30000 });
  for (const term of ['alvaro', 'zambrana', 'a', 'maria', 'jose']) {
    await customerInput.fill('');
    await customerInput.fill(term);
    await sleep(700);
    const firstCustomer = page.locator('[data-index="0"]').first();
    if (await firstCustomer.count()) {
      await firstCustomer.click();
      await sleep(800);
      await page.getByText('Paso 2: ¿Cómo se entrega esta venta?').waitFor({ state: 'visible', timeout: 15000 });
      return;
    }
  }
  throw new Error('No se encontró cliente en búsqueda');
}

async function openFulfillmentPicker(page) {
  const pickerOpen = (await page.getByRole('button', { name: /Para llevar/i }).count()) > 0
    && (await page.getByRole('button', { name: /Con envío incluido/i }).count()) > 0;
  if (pickerOpen) return;
  const cambiarButtons = page.getByRole('button', { name: /^Cambiar$/i });
  const count = await cambiarButtons.count();
  if (count > 0) {
    await cambiarButtons.nth(count - 1).click();
    await sleep(600);
  }
}

async function readUiState(page) {
  return page.evaluate(() => {
    const text = document.body.innerText || '';
    const productSearch = document.querySelector('input[placeholder*="Buscar por nombre, SKU"]');
    return {
      hasUnifiedStep2: text.includes('Paso 2: ¿Cómo se entrega esta venta?'),
      hasOldVehicleStep: text.includes('Paso 2: Seleccionar opción de vehículo'),
      hasOldCarryoutCard: text.includes('Producto para llevar'),
      hasOldLogisticsBlock: text.includes('Opción logística (obligatoria)'),
      hasParaLlevar: text.includes('Para llevar'),
      hasEnvio: text.includes('Con envío incluido'),
      hasInstalado: text.includes('Instalado en vehículo') || text.includes('Instalado —'),
      productSearchEnabled: productSearch ? !productSearch.disabled : false,
      productSearchVisible: Boolean(productSearch),
      vehiclePickerVisible: text.includes('Seleccionar vehículo')
        || document.body.textContent?.includes('Seleccionar vehículo'),
      vehiclePickerDom: Boolean(document.evaluate(
        "//*[contains(normalize-space(.), 'Seleccionar vehículo')]",
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null,
      ).singleNodeValue),
      deliveryFormVisible: text.includes('Mensajero asignado'),
    };
  });
}

async function screenshot(page, name) {
  const file = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

const browser = await chromium.launch({
  headless: true,
  executablePath: CHROME,
});

let exitCode = 0;

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  await loginGerencia(page);
  record('login', `Sesión en ${page.url()}`);
  await resetSaleDrafts(page);
  await ensureSaleFormReady(page);
  await selectFirstCustomer(page);
  await openFulfillmentPicker(page);
  const afterCustomer = await readUiState(page);
  record('cliente', 'Cliente seleccionado');
  record('ui-unificada', `Paso 2 unificado visible=${afterCustomer.hasUnifiedStep2}`, afterCustomer.hasUnifiedStep2);
  record('sin-paso-vehiculo-viejo', `texto viejo ausente=${!afterCustomer.hasOldVehicleStep}`, !afterCustomer.hasOldVehicleStep);
  record('sin-producto-para-llevar', `tarjeta vieja ausente=${!afterCustomer.hasOldCarryoutCard}`, !afterCustomer.hasOldCarryoutCard);
  record('sin-logistica-duplicada', `bloque logística viejo ausente=${!afterCustomer.hasOldLogisticsBlock}`, !afterCustomer.hasOldLogisticsBlock);
  record('opciones-presentes', `para llevar=${afterCustomer.hasParaLlevar}, envío=${afterCustomer.hasEnvio}, instalado=${afterCustomer.hasInstalado}`,
    afterCustomer.hasParaLlevar && afterCustomer.hasEnvio && afterCustomer.hasInstalado);
  await screenshot(page, '01-cliente-seleccionado');

  const paraLlevarBtn = page.getByRole('button', { name: /Para llevar/i }).filter({ hasNot: page.locator(':disabled') }).first();
  await paraLlevarBtn.click({ timeout: 10000 });
  await sleep(700);
  const carryoutState = await readUiState(page);
  record('para-llevar-habilita-productos', `buscador productos habilitado=${carryoutState.productSearchEnabled}`, carryoutState.productSearchEnabled);
  record('para-llevar-sin-vehiculo', `selector vehículo oculto=${!carryoutState.vehiclePickerVisible}`, !carryoutState.vehiclePickerVisible);
  await screenshot(page, '02-para-llevar');

  await openFulfillmentPicker(page);

  const envioBtn = page.getByRole('button', { name: /Con envío incluido/i }).first();
  await envioBtn.click({ timeout: 10000 });
  await sleep(700);
  const deliveryState = await readUiState(page);
  record('envio-muestra-formulario', `formulario delivery visible=${deliveryState.deliveryFormVisible}`, deliveryState.deliveryFormVisible);
  record('envio-habilita-productos', `buscador productos habilitado=${deliveryState.productSearchEnabled}`, deliveryState.productSearchEnabled);
  record('envio-sin-vehiculo', `selector vehículo oculto=${!deliveryState.vehiclePickerVisible}`, !deliveryState.vehiclePickerVisible);
  await screenshot(page, '03-con-envio');

  await openFulfillmentPicker(page);

  const instaladoBtn = page.locator('[class*="rounded-xl"]').getByRole('button', { name: /Instalado en vehículo/i }).first();
  await instaladoBtn.click({ timeout: 10000 });
  await page.getByText('Seleccionar vehículo').waitFor({ state: 'attached', timeout: 5000 }).catch(() => null);
  await sleep(400);
  const installedPickerState = await readUiState(page);
  const vehiclePickerOk = installedPickerState.vehiclePickerVisible || installedPickerState.vehiclePickerDom;
  record(
    'instalado-muestra-vehiculos',
    `selector vehículo visible=${vehiclePickerOk} (inner=${installedPickerState.vehiclePickerVisible}, dom=${installedPickerState.vehiclePickerDom})`,
    vehiclePickerOk,
  );
  record('instalado-bloquea-productos', `buscador productos deshabilitado=${!installedPickerState.productSearchEnabled}`, !installedPickerState.productSearchEnabled);
  await screenshot(page, '04-instalado-sin-vehiculo');

  const vehicleButtons = page.locator('button').filter({ has: page.locator('svg.lucide-car-front, .lucide-car-front') });
  const vehicleCount = await vehicleButtons.count();
  if (vehicleCount > 0) {
    await vehicleButtons.first().click();
    await sleep(700);
    const installedDone = await readUiState(page);
    record('instalado-con-vehiculo-habilita-productos', `buscador habilitado=${installedDone.productSearchEnabled}`, installedDone.productSearchEnabled);
    await screenshot(page, '05-instalado-con-vehiculo');
  } else {
    record('instalado-sin-vehiculos-cliente', 'Cliente sin vehículos — se validó bloqueo de productos', true);
  }

  const failed = results.filter((r) => !r.ok);
  fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify({ base: BASE, results, failed: failed.length }, null, 2));
  console.log(`\nRESUMEN: ${results.length - failed.length}/${results.length} OK`);
  if (failed.length) {
    exitCode = 1;
    console.log('Fallos:', failed.map((f) => f.step).join(', '));
  } else {
    console.log('Todas las pruebas de fulfillment pasaron.');
  }
} catch (error) {
  console.error('ERROR', error);
  exitCode = 1;
} finally {
  await browser.close();
}

process.exit(exitCode);