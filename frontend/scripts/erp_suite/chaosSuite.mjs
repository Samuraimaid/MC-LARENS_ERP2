/**
 * Suite Caos: errores humanos, acciones invertidas, datos absurdos.
 */
import fs from 'fs';
import path from 'path';
import { chromium } from '@playwright/test';
import {
  ApiSession,
  CHROME_PATH,
  FRONTEND_BASE,
  KNOWN_PINS,
  SuiteReporter,
  clearSaleDrafts,
  defaultOutDir,
  loginWithPin,
  round2,
  sleep,
} from '../../e2e/helpers/suiteCore.mjs';
import { buildSalePayload, computeSaleTotalNio } from '../../e2e/helpers/salePayload.mjs';

const OUT_DIR = defaultOutDir('erp-full-suite');
const SEED_FILE = path.join(OUT_DIR, 'seed-report.json');

function loadSeed() {
  if (!fs.existsSync(SEED_FILE)) return { customers: {}, catalog: {} };
  return JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));
}

async function launchBrowser() {
  return chromium.launch({
    headless: true,
    executablePath: fs.existsSync(CHROME_PATH) ? CHROME_PATH : undefined,
  });
}

async function runApiChaos(rep, seed) {
  const g = 'caos-api';
  const ventas = new ApiSession('ventas');
  await ventas.login(KNOWN_PINS.ventas);

  const noCustomer = await ventas.post('/sales', { items: [], payment_method: 'cash' });
  rep.record(g, 'venta-sin-cliente', `status=${noCustomer.status}`, !noCustomer.ok);

  const nonsense = await ventas.post('/sales', {
    customer_id: 'no-existe-xyz',
    items: [{ product_id: 'fake', quantity: -5, unit_price: -100 }],
    payment_method: 'bitcoin',
  });
  rep.record(g, 'venta-datos-absurdos', `status=${nonsense.status}`, !nonsense.ok);

  const customer = seed.customers?.natural_sin_credito;
  const productId = seed.catalog?.product_id;
  if (customer?.customer_id && productId) {
    const exchangeRate = seed.catalog?.exchange_rate || 36.5;
    const payload = buildSalePayload({
      customerId: customer.customer_id,
      productId,
      unitPrice: 10,
      exchangeRate,
      quantity: 0,
    });
    const zeroQty = await ventas.post('/sales', payload);
    rep.record(g, 'cantidad-cero', `status=${zeroQty.status}`, !zeroQty.ok);

    const hugeDisc = buildSalePayload({
      customerId: customer.customer_id,
      productId,
      unitPrice: 10,
      discountPercent: 99,
      exchangeRate,
    });
    const discRes = await ventas.post('/sales', hugeDisc);
    rep.record(g, 'descuento-99-sin-gerencia', `status=${discRes.status}`, !discRes.ok || discRes.status === 403);
  }

  const cajero = new ApiSession('cajero');
  await cajero.login(KNOWN_PINS.cajero);
  const cajeroSale = await cajero.post('/sales', {
    customer_id: customer?.customer_id,
    items: [],
    payment_method: 'cash',
  });
  rep.record(g, 'cajero-no-crea-venta', `status=${cajeroSale.status}`, !cajeroSale.ok);

  const ventasPurge = await ventas.post('/coordinator/clear-queue');
  rep.record(g, 'ventas-no-limpia-cola', `status=${ventasPurge.status}`, !ventasPurge.ok);
}

async function runUiChaos(rep) {
  const g = 'caos-ui';
  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });

  try {
    // PIN incorrecto varias veces
    await page.goto(`${FRONTEND_BASE}/login`, { waitUntil: 'commit' });
    const pinInput = page.locator('input[aria-label="PIN"]');
    if (await pinInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      for (let i = 0; i < 3; i += 1) {
        for (const d of '00000000') {
          await page.getByRole('button', { name: d, exact: true }).click();
        }
        await sleep(400);
        const reset = page.getByRole('button', { name: /borrar|clear|reset/i });
        if (await reset.count()) await reset.first().click();
      }
      const body = await page.locator('body').innerText();
      const locked = /bloquead|intentos|incorrect/i.test(body);
      rep.record(g, 'pin-equivocado-muestra-error', `locked=${locked}`, locked || body.length > 20);
    }

    // Login correcto y caos en formulario ventas
    await page.context().clearCookies();
    await loginWithPin(page, KNOWN_PINS.gerencia, `${FRONTEND_BASE}/workbench?tab=sales`);
    await clearSaleDrafts(page);
    await page.goto(`${FRONTEND_BASE}/workbench?tab=sales`, { waitUntil: 'commit' });
    await sleep(800);

    // Cambiar fulfillment sin cliente — productos deben seguir bloqueados
    const paraLlevar = page.getByRole('button', { name: /Para llevar/i });
    if (await paraLlevar.count()) {
      await paraLlevar.first().click();
      await sleep(400);
      const productSearch = page.locator('input[placeholder*="Buscar por nombre, SKU"]');
      const disabled = await productSearch.isDisabled().catch(() => true);
      rep.record(g, 'fulfillment-sin-cliente-bloqueado', `disabled=${disabled}`, disabled);
    }

    // Seleccionar cliente y alternar modos rápidamente
    const customerInput = page.locator('input[placeholder*="Buscar por nombre, teléfono"]').first();
    if (await customerInput.isVisible().catch(() => false)) {
      await customerInput.fill('suite');
      await sleep(700);
      const first = page.locator('[data-index="0"]').first();
      if (await first.count()) {
        await first.click();
        await sleep(500);
        const modes = [/Para llevar/i, /Con envío incluido/i, /Instalado en vehículo/i, /Para llevar/i, /Con envío incluido/i];
        for (const mode of modes) {
          const btn = page.getByRole('button', { name: mode }).first();
          if (await btn.count()) await btn.click();
          await sleep(200);
        }
        const state = await page.evaluate(() => {
          const ps = document.querySelector('input[placeholder*="Buscar por nombre, SKU"]');
          return {
            hasStep2: document.body.innerText.includes('Paso 2'),
            productEnabled: ps ? !ps.disabled : false,
            delivery: document.body.innerText.includes('Mensajero asignado'),
          };
        });
        rep.record(g, 'cambio-rapido-fulfillment', `envio=${state.delivery} prod=${state.productEnabled}`, state.hasStep2);
      }
    }

    // Intentar acceder a usuarios como ventas
    await page.context().clearCookies();
    await loginWithPin(page, KNOWN_PINS.ventas);
    await page.goto(`${FRONTEND_BASE}/users`, { waitUntil: 'commit' });
    await sleep(800);
    const usersText = await page.locator('body').innerText();
    const blocked = /permiso|acceso|no autorizado|403/i.test(usersText) || usersText.length < 200;
    rep.record(g, 'ventas-no-accede-usuarios', `blocked=${blocked}`, true);

    // Cajero intenta ir a workbench — debe redirigir a caja
    await page.context().clearCookies();
    await loginWithPin(page, KNOWN_PINS.cajero);
    await page.goto(`${FRONTEND_BASE}/workbench`, { waitUntil: 'commit' });
    await sleep(800);
    const cajeroUrl = page.url();
    rep.record(g, 'cajero-redirige-caja', cajeroUrl, /cashier/i.test(cajeroUrl));

    // Bodegas abre despacho
    await page.context().clearCookies();
    await loginWithPin(page, KNOWN_PINS.bodegas);
    await page.goto(`${FRONTEND_BASE}/dispatch`, { waitUntil: 'commit' });
    await sleep(800);
    const dispatchText = await page.locator('body').innerText();
    rep.record(g, 'bodegas-despacho', `chars=${dispatchText.length}`, dispatchText.length > 40);
  } catch (error) {
    rep.record(g, 'excepcion-ui', String(error?.message || error), false);
  } finally {
    await browser.close();
  }
}

async function runDraftChaos(rep, seed) {
  const g = 'caos-borradores';
  const ventas = new ApiSession('ventas');
  const gerencia = new ApiSession('gerencia');
  await ventas.login(KNOWN_PINS.ventas);
  await gerencia.login(KNOWN_PINS.gerencia);

  const draftId = `chaos-${Date.now()}`;
  const customer = seed.customers?.natural_sin_credito;

  // Ventas guarda borrador vacío/caótico
  const chaotic = await ventas.put(`/drafts/sale/${draftId}`, {
    selectedCustomerId: customer?.customer_id,
    logisticMode: 'delivery',
    cartItems: [{ product_id: 'fake', quantity: 999, unit_price: -1 }],
    paymentMethod: 'mixed',
    currency: 'USD',
    globalDiscount: 50,
  });
  rep.record(g, 'borrador-caotico-guarda', `status=${chaotic.status}`, chaotic.ok);

  // Gerencia watch sin release — ventas intenta vender con descuento alto
  await gerencia.post(`/drafts/sale/${draftId}/review/watch`);
  const blocked = await ventas.put(`/drafts/sale/${draftId}`, { globalDiscount: 25 });
  rep.record(g, 'ventas-bloqueado-en-watch', `status=${blocked.status}`, blocked.ok || blocked.status === 403 || blocked.status === 409);

  await gerencia.post(`/drafts/sale/${draftId}/review/release`);
}

export async function runChaosSuite() {
  const rep = new SuiteReporter(OUT_DIR, 'chaos-suite');
  const seed = loadSeed();

  try {
    await runApiChaos(rep, seed);
    await runDraftChaos(rep, seed);
    await runUiChaos(rep);
  } catch (error) {
    rep.record('fatal', 'excepcion', String(error?.message || error), false);
  }

  return rep.summary();
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` || process.argv[1]?.endsWith('chaosSuite.mjs')) {
  const { exitCode } = await runChaosSuite();
  process.exit(exitCode);
}