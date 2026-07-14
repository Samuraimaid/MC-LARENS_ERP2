/**
 * Suite UI: páginas por rol, formularios ventas/cotizaciones, caja, alineación visual.
 */
import fs from 'fs';
import { chromium } from '@playwright/test';
import {
  CHROME_PATH,
  FRONTEND_BASE,
  KNOWN_PINS,
  SuiteReporter,
  clearQuoteDrafts,
  clearSaleDrafts,
  defaultOutDir,
  gotoSafe,
  loginWithPin,
  sleep,
} from '../../e2e/helpers/suiteCore.mjs';

const OUT_DIR = defaultOutDir('erp-full-suite');

const ROLE_HOMES = [
  { role: 'gerencia', pin: KNOWN_PINS.gerencia, expectPath: /workbench|dashboard/ },
  { role: 'ventas', pin: KNOWN_PINS.ventas, expectPath: /workbench/ },
  { role: 'cajero', pin: KNOWN_PINS.cajero, expectPath: /cashier/ },
  { role: 'bodegas', pin: KNOWN_PINS.bodegas, expectPath: /dispatch|workbench/ },
];

const GERENCIA_PAGES = [
  { path: '/workbench?tab=sales', label: 'Workbench Ventas', minChars: 80 },
  { path: '/workbench?tab=quotations', label: 'Workbench Cotizaciones', minChars: 80 },
  { path: '/sales', label: 'Ventas', minChars: 80 },
  { path: '/quotations', label: 'Cotizaciones', minChars: 80 },
  { path: '/cashier', label: 'Caja', minChars: 60 },
  { path: '/customers', label: 'Clientes', minChars: 60 },
  { path: '/vehicles', label: 'Vehículos', minChars: 60 },
  { path: '/inventory', label: 'Inventario', minChars: 60 },
  { path: '/dispatch', label: 'Despacho', minChars: 60 },
  { path: '/credits', label: 'Créditos', minChars: 40 },
  { path: '/quality-control', label: 'Control Calidad', minChars: 40 },
  { path: '/work-orders', label: 'Órdenes Trabajo', minChars: 40 },
  { path: '/deliveries', label: 'Entregas', minChars: 40 },
  { path: '/coordinator/instalaciones', label: 'Coord. Instalaciones', minChars: 40 },
  { path: '/coordinator/polarizados', label: 'Coord. Polarizados', minChars: 40 },
  { path: '/human-resources', label: 'RRHH', minChars: 40 },
  { path: '/users', label: 'Usuarios', minChars: 40 },
  { path: '/approvals', label: 'Aprobaciones', minChars: 30 },
  { path: '/kds/bodega', label: 'KDS Bodega', minChars: 30 },
  { path: '/kds/instalaciones', label: 'KDS Instalaciones', minChars: 30 },
  { path: '/kds/polarizados', label: 'KDS Polarizados', minChars: 30 },
];

async function launchBrowser() {
  return chromium.launch({
    headless: true,
    executablePath: fs.existsSync(CHROME_PATH) ? CHROME_PATH : undefined,
  });
}

async function selectFirstCustomer(page) {
  const input = page.locator('input[placeholder*="Buscar por nombre, teléfono"]').first();
  const visible = await input.isVisible().catch(() => false);
  if (!visible) return false;
  for (const term of ['suite', 'alvaro', 'maria', 'a']) {
    await input.fill('');
    await input.fill(term);
    await sleep(600);
    const first = page.locator('[data-index="0"]').first();
    if (await first.count()) {
      await first.click();
      await sleep(700);
      return true;
    }
  }
  return false;
}

async function openFulfillmentPicker(page) {
  const open = (await page.getByRole('button', { name: /Para llevar/i }).count()) > 0;
  if (open) return;
  const cambiar = page.getByRole('button', { name: /^Cambiar$/i });
  if (await cambiar.count()) {
    await cambiar.last().click();
    await sleep(500);
  }
}

async function readFormState(page) {
  return page.evaluate(() => {
    const text = document.body.innerText || '';
    const productSearch = document.querySelector('input[placeholder*="Buscar por nombre, SKU"]');
    return {
      step2Unified: text.includes('Paso 2: ¿Cómo se entrega esta venta?'),
      oldLogistics: text.includes('Opción logística (obligatoria)'),
      oldCarryout: text.includes('Producto para llevar'),
      productEnabled: productSearch ? !productSearch.disabled : false,
      vehiclePicker: text.includes('Seleccionar vehículo'),
      deliveryForm: text.includes('Mensajero asignado'),
    };
  });
}

async function runRoleRedirectTests(rep, page) {
  const g = 'ui-roles';
  for (const spec of ROLE_HOMES) {
    await page.context().clearCookies();
    await page.goto(`${FRONTEND_BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(500);
    const pinInput = page.locator('input[aria-label="PIN"]');
    const hasPin = await pinInput.waitFor({ state: 'visible', timeout: 12000 }).then(() => true).catch(() => false);
    if (!hasPin) {
      rep.warn(g, `login-${spec.role}`, 'PIN pad no visible — frontend puede estar caído');
      continue;
    }
    for (const digit of String(spec.pin).split('')) {
      await page.getByRole('button', { name: digit, exact: true }).click();
    }
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 45000 });
    const url = page.url();
    const match = spec.expectPath.test(url);
    rep.record(g, `home-${spec.role}`, url, match);
  }
}

async function runGerenciaPages(rep, page) {
  const g = 'ui-paginas';
  await page.context().clearCookies();
  await loginWithPin(page, KNOWN_PINS.gerencia);
  for (const route of GERENCIA_PAGES) {
    try {
      await gotoSafe(page, `${FRONTEND_BASE}${route.path}`);
      await sleep(1200);
      const text = (await page.locator('body').innerText()).trim();
      const ok = text.length >= route.minChars && !/error fatal|something went wrong/i.test(text);
      rep.record(g, route.label, `chars=${text.length}`, ok);
    } catch (error) {
      rep.record(g, route.label, String(error?.message || error), false);
    }
  }
}

async function runSalesFormTests(rep, page) {
  const g = 'ui-ventas-form';
  await page.context().clearCookies();
  await loginWithPin(page, KNOWN_PINS.gerencia, `${FRONTEND_BASE}/workbench?tab=sales`);
  await page.waitForSelector('nav[aria-label="Progreso del formulario"]', { timeout: 45000 }).catch(() => null);
  await clearSaleDrafts(page);
  await gotoSafe(page, `${FRONTEND_BASE}/workbench?tab=sales`);
  await sleep(1200);

  const customerInput = page.locator('input[placeholder*="Buscar por nombre, teléfono"]').first();
  const inputReady = await customerInput.waitFor({ state: 'visible', timeout: 30000 }).then(() => true).catch(() => false);
  if (!inputReady) {
    rep.warn(g, 'formulario-ventas', 'buscador de cliente no visible — ¿formulario colapsado?');
    return;
  }

  const hasCustomer = await selectFirstCustomer(page);
  rep.record(g, 'seleccionar-cliente', `ok=${hasCustomer}`, hasCustomer);
  if (!hasCustomer) return;

  await openFulfillmentPicker(page);
  let state = await readFormState(page);
  rep.record(g, 'paso2-unificado', `visible=${state.step2Unified}`, state.step2Unified);
  rep.record(g, 'sin-logistica-vieja', `absent=${!state.oldLogistics}`, !state.oldLogistics);
  rep.record(g, 'sin-para-llevar-viejo', `absent=${!state.oldCarryout}`, !state.oldCarryout);

  await page.getByRole('button', { name: /Para llevar/i }).first().click();
  await sleep(600);
  state = await readFormState(page);
  rep.record(g, 'para-llevar-productos', `enabled=${state.productEnabled}`, state.productEnabled);

  await openFulfillmentPicker(page);
  await page.getByRole('button', { name: /Con envío incluido/i }).first().click();
  await sleep(600);
  state = await readFormState(page);
  rep.record(g, 'envio-formulario', `delivery=${state.deliveryForm}`, state.deliveryForm);
  rep.record(g, 'envio-productos', `enabled=${state.productEnabled}`, state.productEnabled);

  await openFulfillmentPicker(page);
  await page.locator('[class*="rounded-xl"]').getByRole('button', { name: /Instalado en vehículo/i }).first().click();
  await page.getByText('Seleccionar vehículo').waitFor({ state: 'attached', timeout: 5000 }).catch(() => null);
  await sleep(400);
  state = await readFormState(page);
  const pickerOk = state.vehiclePicker || (await page.getByText('Seleccionar vehículo').count()) > 0;
  rep.record(g, 'instalado-vehiculos', `picker=${pickerOk}`, pickerOk);
  rep.record(g, 'instalado-bloquea', `disabled=${!state.productEnabled}`, !state.productEnabled);
}

async function runQuotationParityTests(rep, page) {
  const g = 'ui-cotizaciones-paridad';
  await page.context().clearCookies();
  await loginWithPin(page, KNOWN_PINS.gerencia, `${FRONTEND_BASE}/workbench?tab=quotations`);
  await page.waitForSelector('nav[aria-label="Progreso del formulario"]', { timeout: 45000 }).catch(() => null);
  await clearQuoteDrafts(page);
  await page.goto(`${FRONTEND_BASE}/workbench?tab=quotations`, { waitUntil: 'commit' });
  await sleep(1000);

  const bodyText = await page.locator('body').innerText();
  const hasUnified = bodyText.includes('Paso 2: ¿Cómo se entrega esta venta?')
    || bodyText.includes('Paso 2:');
  rep.record(g, 'cotizacion-carga', `chars=${bodyText.length}`, bodyText.length > 80);

  const hasCustomer = await selectFirstCustomer(page);
  if (!hasCustomer) {
    rep.warn(g, 'cliente-skip', 'no se pudo seleccionar cliente en cotizaciones');
    return;
  }
  await openFulfillmentPicker(page);
  const state = await readFormState(page);
  rep.record(g, 'cotizacion-paso2-unificado', `unified=${state.step2Unified}`, state.step2Unified);
  rep.record(g, 'cotizacion-sin-duplicados', `ok=${!state.oldLogistics && !state.oldCarryout}`, !state.oldLogistics && !state.oldCarryout);

  const hasParaLlevar = (await page.getByRole('button', { name: /Para llevar/i }).count()) > 0;
  const hasEnvio = (await page.getByRole('button', { name: /Con envío incluido/i }).count()) > 0;
  const hasInstalado = (await page.getByRole('button', { name: /Instalado en vehículo/i }).count()) > 0;
  rep.record(g, 'cotizacion-opciones-entrega', `llevar=${hasParaLlevar} envio=${hasEnvio} inst=${hasInstalado}`, hasParaLlevar && hasEnvio && hasInstalado);
}

async function runCashierUiTests(rep, page) {
  const g = 'ui-caja';
  await page.context().clearCookies();
  await loginWithPin(page, KNOWN_PINS.cajero);
  await page.goto(`${FRONTEND_BASE}/cashier`, { waitUntil: 'commit', timeout: 60000 });
  await sleep(1000);
  const text = await page.locator('body').innerText();
  rep.record(g, 'caja-carga', `chars=${text.length}`, text.length > 60);

  const abonosTab = page.getByRole('tab', { name: /Abonos/i });
  if (await abonosTab.count()) {
    await abonosTab.click();
    await sleep(700);
    const abonosText = await page.locator('body').innerText();
    rep.record(g, 'tab-abonos', `visible=${/abono|crédito|pendiente/i.test(abonosText)}`, /abono|crédito|pendiente/i.test(abonosText));
  } else {
    rep.warn(g, 'tab-abonos', 'tab Abonos no encontrado');
  }
}

export async function runUiSuite() {
  const rep = new SuiteReporter(OUT_DIR, 'ui-suite');
  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });

  try {
    await runRoleRedirectTests(rep, page);
    await runGerenciaPages(rep, page);
    await runSalesFormTests(rep, page);
    await runQuotationParityTests(rep, page);
    await runCashierUiTests(rep, page);
  } catch (error) {
    rep.record('fatal', 'excepcion', String(error?.message || error), false);
  } finally {
    await browser.close();
  }

  return rep.summary();
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` || process.argv[1]?.endsWith('uiSuite.mjs')) {
  const { exitCode } = await runUiSuite();
  process.exit(exitCode);
}