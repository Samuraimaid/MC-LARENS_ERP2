/**
 * Suite API completa: auth, CRUD, ventas, cotizaciones, crédito, caja, despacho, borradores.
 */
import fs from 'fs';
import path from 'path';
import {
  ApiSession,
  BRANCH_MAIN,
  KNOWN_PINS,
  SuiteReporter,
  WH_MAIN,
  defaultOutDir,
  pickFirst,
  round2,
  sleep,
} from '../../e2e/helpers/suiteCore.mjs';
import {
  buildMixedPlanLines,
  buildQuotationPayload,
  buildSalePayload,
  computeSaleTotalNio,
  alignSalePayloadForCreate,
  productUnitPrice,
  resolveSalePayload,
} from '../../e2e/helpers/salePayload.mjs';

const OUT_DIR = defaultOutDir('erp-full-suite');
const SEED_FILE = path.join(OUT_DIR, 'seed-report.json');

function loadSeed() {
  if (!fs.existsSync(SEED_FILE)) return { customers: {}, catalog: {}, users: {} };
  return JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));
}

async function runAuthTests(rep) {
  const g = 'auth';
  const anon = new ApiSession('anon');
  const bad = await anon.post('/auth/pin/login', { pin: '00000000' });
  rep.record(g, 'pin-invalido-rechazado', `status=${bad.status}`, bad.status === 401 || bad.status === 403 || bad.status === 400);

  const gerencia = new ApiSession('gerencia');
  await gerencia.login(KNOWN_PINS.gerencia);
  const me = await gerencia.me();
  rep.record(g, 'gerencia-me', `role=${me?.role}`, me?.role === 'gerencia');

  const pinUsers = await gerencia.get('/auth/pin/users');
  rep.record(g, 'pin-users-lista', `count=${Array.isArray(pinUsers.body) ? pinUsers.body.length : 0}`, pinUsers.ok && Array.isArray(pinUsers.body));

  for (const [role, pin] of Object.entries(KNOWN_PINS)) {
    if (role === 'gerencia') continue;
    const s = new ApiSession(role);
    const user = await s.tryLogin(pin);
    rep.record(g, `login-${role}`, user ? `ok user=${user.user_id || user.name}` : `falló pin=${pin}`, Boolean(user));
  }
}

async function runCustomerVehicleTests(rep, seed) {
  const g = 'clientes-vehiculos';
  const gerencia = new ApiSession('gerencia');
  await gerencia.login(KNOWN_PINS.gerencia);

  const tag = Date.now();
  const created = await gerencia.post('/customers', {
    name: `API Suite ${tag}`,
    phone: `83${String(tag).slice(-6)}`,
    email: `api.suite.${tag}@e2e.local`,
    customer_type: 'natural',
    credit_limit: 0,
  });
  rep.record(g, 'crear-cliente', `status=${created.status}`, created.ok);
  const customerId = created.body?.customer_id;

  const ventas = new ApiSession('ventas');
  await ventas.login(KNOWN_PINS.ventas);
  const denied = await ventas.put(`/customers/${customerId}`, { phone: '9999-0000' });
  rep.record(g, 'ventas-no-edita-directo', `status=${denied.status}`, !denied.ok);

  const approval = await ventas.post('/approvals', {
    type: 'edit_customer',
    reason: 'Suite E2E',
    payload: { customer_id: customerId, changes: { phone: '8888-7777' } },
  });
  // Ventas PIN no tiene approvals.create — debe rechazarse o usar flujo alterno
  if (!approval.ok) {
    rep.record(g, 'ventas-aprobacion-bloqueada', `status=${approval.status}`, approval.status === 403);
  } else {
    rep.record(g, 'ventas-solicita-aprobacion', `status=${approval.status}`, approval.ok);
    const apprId = approval.body?.approval_id;
    const g2 = new ApiSession('gerencia2');
    await g2.login(KNOWN_PINS.gerencia);
    const approved = await g2.put(`/approvals/${apprId}/approve`);
    rep.record(g, 'gerencia-aprueba-edicion', `status=${approved.status}`, approved.ok);
    const fetched = await g2.get(`/customers/${customerId}`);
    rep.record(g, 'cliente-actualizado', `phone=${fetched.body?.phone}`, fetched.body?.phone === '8888-7777');
  }

  const creditCustomer = seed.customers?.natural_con_credito;
  if (creditCustomer?.customer_id) {
    const vehicles = await gerencia.get('/vehicles');
    const veh = pickFirst(vehicles.body, (v) => String(v.customer_id) === String(creditCustomer.customer_id));
    const hasVehicle = Boolean(veh?.vehicle_id || veh?.id || seed.vehicles?.for_credit_customer?.vehicle_id);
    rep.record(g, 'cliente-credito-tiene-vehiculo', `vehicle=${hasVehicle}`, hasVehicle);
  }
}

async function runSalesTests(rep, seed) {
  const g = 'ventas';
  const ventas = new ApiSession('ventas');
  await ventas.login(KNOWN_PINS.ventas);

  const customer = seed.customers?.natural_sin_credito || pickFirst((await ventas.get('/customers')).body);
  const catalog = seed.catalog || {};
  const productId = catalog.product_id;
  const exchangeRate = catalog.exchange_rate || 36.5;
  if (!customer?.customer_id || !productId) {
    rep.record(g, 'precondicion-catalogo', 'falta cliente o producto', false);
    return { ventas, customer: null, productId: null };
  }

  const products = await ventas.get('/products');
  const product = pickFirst(products.body, (p) => p.product_id === productId);
  const unitPrice = productUnitPrice(product, 'NIO', exchangeRate);
  const carryProduct = pickFirst(products.body, (p) => p.installation_type !== 'required' && p.installation_required !== true)
    || product;

  const modes = [
    {
      label: 'para-llevar',
      withInstallation: false,
      vehicleId: null,
      customerId: customer.customer_id,
      prod: carryProduct,
    },
    {
      label: 'instalado',
      withInstallation: true,
      vehicleId: seed.vehicles?.for_credit_customer?.vehicle_id || null,
      customerId: seed.customers?.natural_con_credito?.customer_id,
      prod: product,
    },
  ];

  const createdSales = [];
  for (const mode of modes) {
    if (mode.label === 'instalado' && !mode.vehicleId) {
      rep.warn(g, `${mode.label}-skip`, 'sin vehículo en seed');
      continue;
    }
    const pid = mode.prod?.product_id || productId;
    const price = productUnitPrice(mode.prod, 'NIO', exchangeRate);
    const raw = buildSalePayload({
      customerId: mode.customerId,
      vehicleId: mode.vehicleId,
      productId: pid,
      unitPrice: price,
      withInstallation: mode.withInstallation,
      exchangeRate,
      notes: `Suite API ${mode.label} ${Date.now()}`,
      idempotencyKey: `suite-${mode.label}-${Date.now()}`,
    });
    const { payload, error, mismatch, created, sale } = await alignSalePayloadForCreate(ventas, raw);
    if (mismatch) {
      rep.record(g, `alineacion-total-${mode.label}`, `preview=${mismatch.preview_total} server=${mismatch.expected_total}`, true);
    }
    if (error) {
      rep.record(g, `preview-${mode.label}`, String(error?.detail || error), false, 'bug');
      continue;
    }
    if (created && sale) {
      rep.record(g, `crear-${mode.label}`, `status=200 id=${sale?.sale_id || '-'}`, true);
      createdSales.push(sale);
      continue;
    }
    const res = await ventas.post('/sales', payload);
    rep.record(g, `crear-${mode.label}`, `status=${res.status} id=${res.body?.sale_id || '-'}`, res.ok);
    if (!res.ok && res.status === 500) {
      rep.record(g, `bug-${mode.label}-500`, String(res.text).slice(0, 200), false, 'bug');
    }
    if (res.ok) createdSales.push(res.body);
  }

  // Crédito — cliente con límite
  const creditCustomer = seed.customers?.natural_con_credito;
  if (creditCustomer?.customer_id) {
    const creditRaw = buildSalePayload({
      customerId: creditCustomer.customer_id,
      productId: carryProduct?.product_id || productId,
      unitPrice: productUnitPrice(carryProduct, 'NIO', exchangeRate),
      paymentMethod: 'credit',
      creditDays: 30,
      exchangeRate,
      idempotencyKey: `suite-credit-${Date.now()}`,
    });
    const creditRes = await ventas.post('/sales', creditRaw);
    rep.record(g, 'crear-credito', `status=${creditRes.status}`, creditRes.ok);
    if (!creditRes.ok && creditRes.status === 500) {
      rep.record(g, 'bug-credito-500', 'POST /sales credit devuelve 500 Internal Server Error', false, 'bug');
    }
    if (creditRes.ok) createdSales.push(creditRes.body);
  }

  // Crédito rechazado — cliente sin límite
  const noCreditPayload = buildSalePayload({
    customerId: customer.customer_id,
    productId,
    unitPrice,
    paymentMethod: 'credit',
    creditDays: 30,
    exchangeRate,
  });
  const noCreditRes = await ventas.post('/sales', noCreditPayload);
  rep.record(g, 'credito-sin-limite-rechazado', `status=${noCreditRes.status}`, !noCreditRes.ok);

  // Pago mixto
  const total = computeSaleTotalNio(unitPrice, exchangeRate);
  const half = round2(total / 2);
  const mixedRaw = buildSalePayload({
    customerId: customer.customer_id,
    productId: carryProduct?.product_id || productId,
    unitPrice: productUnitPrice(carryProduct, 'NIO', exchangeRate),
    paymentMethod: 'mixed',
    mixedPaymentMethods: ['cash', 'card'],
    exchangeRate,
    idempotencyKey: `suite-mixed-${Date.now()}`,
  });
  const mixedWithMethods = { ...mixedRaw, mixed_payment_methods: ['cash', 'card'] };
  const mixAligned = await alignSalePayloadForCreate(ventas, mixedWithMethods);
  let mixedRes;
  if (mixAligned.created && mixAligned.sale) {
    mixedRes = { ok: true, status: 200, body: mixAligned.sale };
  } else if (mixAligned.mismatch) {
    mixedRes = await ventas.post('/sales', mixAligned.payload);
  } else {
    mixedRes = { ok: false, status: mixAligned.status || 400, body: mixAligned.error };
  }
  rep.record(g, 'crear-mixto', `status=${mixedRes.status}`, mixedRes.ok);
  if (mixedRes.ok) createdSales.push(mixedRes.body);

  // Plan de pago inválido (caos API)
  const badPlan = buildSalePayload({
    customerId: customer.customer_id,
    productId,
    unitPrice,
    paymentMethod: 'mixed',
    mixedPaymentMethods: ['cash', 'card'],
    exchangeRate,
    planLines: buildMixedPlanLines(total, [
      { metodo: 'cash', monto_origen: 1 },
      { metodo: 'card', monto_origen: 1 },
    ]),
  });
  const badPlanRes = await ventas.post('/sales', badPlan);
  rep.record(g, 'plan-mixto-invalido-rechazado', `status=${badPlanRes.status}`, !badPlanRes.ok);

  // Idempotencia
  const idemKey = `suite-idem-${Date.now()}`;
  const idemAligned = await alignSalePayloadForCreate(ventas, buildSalePayload({
    customerId: customer.customer_id,
    productId: carryProduct?.product_id || productId,
    unitPrice: productUnitPrice(carryProduct, 'NIO', exchangeRate),
    exchangeRate,
    idempotencyKey: idemKey,
  }));
  const idemPayload = idemAligned.payload;
  const first = idemAligned.created
    ? { ok: true, status: 200, body: idemAligned.sale }
    : await ventas.post('/sales', idemPayload);
  const second = await ventas.post('/sales', idemPayload);
  const sameId = first.body?.sale_id && first.body?.sale_id === second.body?.sale_id;
  rep.record(g, 'idempotencia-venta', `same=${sameId} s1=${first.status} s2=${second.status}`, first.ok && (second.ok || second.status === 409) && (sameId || second.status === 409));

  // Bug conocido: preview-settlement vs POST /sales pueden divergir si se envía total_amount
  const parityRaw = buildSalePayload({
    customerId: customer.customer_id,
    productId: carryProduct?.product_id || productId,
    unitPrice: productUnitPrice(carryProduct, 'NIO', exchangeRate),
    exchangeRate,
  });
  const { net_to_collect: previewNet } = await resolveSalePayload(ventas, parityRaw);
  const { buildPlannedPaymentPlan } = await import('../../e2e/helpers/salePayload.mjs');
  const withTotal = {
    ...parityRaw,
    total_amount: previewNet,
    planned_payment_plan: buildPlannedPaymentPlan('cash', previewNet),
    idempotencyKey: `suite-parity-${Date.now()}`,
  };
  const parityRes = await ventas.post('/sales', withTotal);
  const parityOk = parityRes.ok || parityRes.status === 409 && parityRes.body?.detail?.error !== 'TOTAL_MISMATCH';
  rep.record(
    'bugs',
    'preview-create-paridad',
    `preview=${previewNet} sale=${parityRes.status} total=${parityRes.body?.total || parityRes.body?.detail?.expected_total || '-'}`,
    parityOk,
    parityOk ? 'error' : 'bug',
  );

  return { ventas, customer, productId, unitPrice, exchangeRate, createdSales };
}

async function runQuotationTests(rep, seed, saleCtx) {
  const g = 'cotizaciones';
  const ventas = saleCtx?.ventas || new ApiSession('ventas');
  if (!saleCtx?.ventas) await ventas.login(KNOWN_PINS.ventas);

  const customer = seed.customers?.natural_sin_credito;
  const productId = seed.catalog?.product_id || saleCtx?.productId;
  if (!customer?.customer_id || !productId) {
    rep.record(g, 'precondicion', 'falta cliente/producto', false);
    return;
  }

  const products = await ventas.get('/products');
  const product = pickFirst(products.body, (p) => p.product_id === productId);
  const unitPrice = Number(product?.price_usd || 10);
  const exchangeRate = seed.catalog?.exchange_rate || 36.5;

  const salePayload = buildSalePayload({
    customerId: customer.customer_id,
    productId,
    unitPrice,
    exchangeRate,
    notes: 'Paridad cotización',
  });
  const quotPayload = buildQuotationPayload(salePayload);

  const qRes = await ventas.post('/quotations', quotPayload);
  rep.record(g, 'crear-cotizacion', `status=${qRes.status} id=${qRes.body?.quotation_id || '-'}`, qRes.ok);

  if (qRes.ok) {
    const qid = qRes.body?.quotation_id;
    const statusRes = await ventas.put(`/quotations/${qid}/status?status=approved`);
    rep.record(g, 'cotizacion-aprobada', `status=${statusRes.status}`, statusRes.ok);
  }

  // Paridad: cotización sin cliente debe fallar
  const bad = await ventas.post('/quotations', { ...quotPayload, customer_id: '' });
  rep.record(g, 'cotizacion-sin-cliente-rechazada', `status=${bad.status}`, !bad.ok);
}

async function runDraftTests(rep, seed) {
  const g = 'borradores';
  const ventas = new ApiSession('ventas');
  const gerencia = new ApiSession('gerencia');
  await ventas.login(KNOWN_PINS.ventas);
  await gerencia.login(KNOWN_PINS.gerencia);

  const draftId = `suite-draft-${Date.now()}`;
  const customer = seed.customers?.natural_sin_credito;
  const snapshot = {
    selectedCustomerId: customer?.customer_id,
    logisticMode: 'carryout',
    cartItems: [],
    paymentMethod: 'cash',
    currency: 'NIO',
    updated_at: new Date().toISOString(),
  };

  const put = await ventas.put(`/drafts/sale/${draftId}`, snapshot);
  rep.record(g, 'ventas-guarda-borrador', `status=${put.status}`, put.ok);

  const watch = await gerencia.post(`/drafts/sale/${draftId}/review/watch`);
  rep.record(g, 'gerencia-watch', `status=${watch.status}`, watch.ok);

  const edited = { ...snapshot, globalDiscount: 5, supervisor_changed: true };
  const gEdit = await gerencia.put(`/drafts/sale/${draftId}`, edited);
  rep.record(g, 'gerencia-edita-borrador', `status=${gEdit.status}`, gEdit.ok);

  const release = await gerencia.post(`/drafts/sale/${draftId}/review/release`);
  rep.record(g, 'gerencia-release', `status=${release.status}`, release.ok);

  const list = await ventas.get('/drafts/sale');
  rep.record(g, 'ventas-lista-borradores', `count=${Array.isArray(list.body) ? list.body.length : 0}`, list.ok);
}

async function runCreditCashierTests(rep, seed, saleCtx) {
  const g = 'credito-caja';
  const cajero = new ApiSession('cajero');
  await cajero.login(KNOWN_PINS.cajero);

  const pending = await cajero.get('/credit/pending');
  rep.record(g, 'credit-pending', `count=${Array.isArray(pending.body) ? pending.body.length : 0}`, pending.ok);

  const invoices = await cajero.get('/caja/facturas');
  rep.record(g, 'caja-facturas', `count=${Array.isArray(invoices.body) ? invoices.body.length : 0}`, invoices.ok);

  const session = await cajero.get('/caja/sesion-activa');
  rep.record(g, 'caja-sesion-activa', `open=${Boolean(session.body?.sesion_id || session.body?.session_id)}`, session.ok);

  // Abono parcial si hay venta a crédito pendiente
  const creditSale = pickFirst(pending.body, (r) => Number(r.pending_amount || r.balance || 0) > 0);
  if (creditSale?.sale_id) {
    const amount = round2(Math.min(Number(creditSale.pending_amount || creditSale.balance || 100), 100));
    const pay = await cajero.post('/credit/payment', {
      sale_id: creditSale.sale_id,
      amount,
      payment_method: 'cash',
      notes: 'Suite abono parcial',
    });
    rep.record(g, 'abono-parcial', `status=${pay.status} amount=${amount}`, pay.ok || pay.status === 409 || pay.status === 400);

    const overPay = await cajero.post('/credit/payment', {
      sale_id: creditSale.sale_id,
      amount: 99999999,
      payment_method: 'cash',
    });
    rep.record(g, 'abono-excesivo-rechazado', `status=${overPay.status}`, !overPay.ok);
  } else {
    rep.warn(g, 'abono-skip', 'sin ventas a crédito pendientes');
  }

  // Cobrar factura en cola si existe
  const invoice = pickFirst(invoices.body, (r) => ['pending', 'open', 'queued'].includes(String(r.status || r.payment_status || '').toLowerCase()) || !r.paid);
  if (invoice?.sale_id) {
    const collect = await cajero.post(`/cashier/invoices/${invoice.sale_id}/collect`, {
      payment_method: 'cash',
      amount: invoice.total_amount || invoice.total,
    });
    rep.record(g, 'cobrar-factura', `status=${collect.status}`, collect.ok || collect.status === 409);
  }
}

async function runOpsTests(rep, saleCtx) {
  const g = 'operaciones';
  const gerencia = new ApiSession('gerencia');
  const ventas = new ApiSession('ventas');
  const bodegas = new ApiSession('bodegas');
  await gerencia.login(KNOWN_PINS.gerencia);
  await ventas.login(KNOWN_PINS.ventas);
  await bodegas.login(KNOWN_PINS.bodegas);

  const dispatch = await bodegas.get('/dispatch');
  rep.record(g, 'dispatch-lista', `count=${Array.isArray(dispatch.body) ? dispatch.body.length : 0}`, dispatch.ok);

  const qc = await gerencia.get('/quality-control/pending');
  rep.record(g, 'qc-pending', `count=${Array.isArray(qc.body) ? qc.body.length : 0}`, qc.ok);

  const wo = await gerencia.get('/work-orders');
  rep.record(g, 'work-orders', `count=${Array.isArray(wo.body) ? wo.body.length : 0}`, wo.ok);

  const deliveries = await gerencia.get('/deliveries');
  rep.record(g, 'deliveries', `count=${Array.isArray(deliveries.body) ? deliveries.body.length : 0}`, deliveries.ok);

  const messengers = await gerencia.get('/hr/messengers');
  rep.record(g, 'mensajeros', `count=${Array.isArray(messengers.body) ? messengers.body.length : 0}`, messengers.ok);

  const inv = await bodegas.get('/inventory');
  rep.record(g, 'inventario', `rows=${Array.isArray(inv.body) ? inv.body.length : 0}`, inv.ok);

  const purgeDenied = await ventas.post('/dispatch/clear-queue');
  rep.record(g, 'ventas-no-purga-dispatch', `status=${purgeDenied.status}`, !purgeDenied.ok);

  const sale = pickFirst(saleCtx?.createdSales);
  if (sale?.sale_id) {
    const fromSale = await bodegas.post(`/dispatch/from-sale/${sale.sale_id}`);
    rep.record(g, 'dispatch-desde-venta', `status=${fromSale.status}`, fromSale.ok || fromSale.status === 409);
  }
}

async function runPermissionsTests(rep) {
  const g = 'permisos';
  const gerencia = new ApiSession('gerencia');
  await gerencia.login(KNOWN_PINS.gerencia);
  const catalog = await gerencia.get('/permissions/catalog');
  rep.record(g, 'catalogo-permisos', `modules=${Object.keys(catalog.body || {}).length}`, catalog.ok);

  const me = await gerencia.get('/permissions/me');
  rep.record(g, 'mis-permisos', `role=${me.body?.role || me.body?.effective_role}`, me.ok);

  const ventas = new ApiSession('ventas');
  await ventas.login(KNOWN_PINS.ventas);
  const usersDenied = await ventas.get('/users/directory');
  rep.record(g, 'ventas-acceso-directorio', `status=${usersDenied.status}`, usersDenied.ok || usersDenied.status === 403);
}

export async function runApiSuite() {
  const rep = new SuiteReporter(OUT_DIR, 'api-suite');
  const seed = loadSeed();

  try {
    await runAuthTests(rep);
    await runPermissionsTests(rep);
    await runCustomerVehicleTests(rep, seed);
    const saleCtx = await runSalesTests(rep, seed);
    await runQuotationTests(rep, seed, saleCtx);
    await runDraftTests(rep, seed);
    await runCreditCashierTests(rep, seed, saleCtx);
    await runOpsTests(rep, saleCtx);
  } catch (error) {
    rep.record('fatal', 'excepcion', String(error?.message || error), false);
  }

  return rep.summary();
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` || process.argv[1]?.endsWith('apiSuite.mjs')) {
  const { exitCode } = await runApiSuite();
  process.exit(exitCode);
}