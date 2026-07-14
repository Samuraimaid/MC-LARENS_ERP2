/**
 * Núcleo compartido para la suite E2E completa del ERP.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const FRONTEND_BASE = process.env.FRONTEND_BASE || process.env.BASE_URL || 'http://127.0.0.1:3000';
export const API_BASE = (process.env.BACKEND_BASE || process.env.BACKEND_URL || 'http://127.0.0.1:8001').replace(/\/$/, '') + '/api';
export const CHROME_PATH = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
export const RUN_TAG = process.env.SUITE_RUN_TAG || new Date().toISOString().replace(/[:.]/g, '-');

export const KNOWN_PINS = {
  gerencia: process.env.TEST_PIN || '01011990',
  ventas: process.env.VENTAS_PIN || '55667788',
  cajero: process.env.CASHIER_PIN || '11223344',
  supervisor: process.env.SUPERVISOR_PIN || '00000003',
  bodegas: process.env.BODEGAS_PIN || '00000010',
  instalaciones: process.env.INSTALACIONES_PIN || '00000012',
  polarizador: process.env.POLARIZADOR_PIN || '00000009',
  coordinador_instalaciones: process.env.COORD_INST_PIN || '88112233',
  coordinador_polarizados: process.env.COORD_POL_PIN || '88223344',
  transporte: process.env.TRANSPORTE_PIN || '00000011',
  entregador: process.env.ENTREGADOR_PIN || '00000015',
  recursos_humanos: process.env.RRHH_PIN || '00000002',
  jefe_vendedores: process.env.JEFE_VENTAS_PIN || '00000006',
  jefe_tienda: process.env.JEFE_TIENDA_PIN || '00000007',
  electrico: process.env.ELECTRICO_PIN || '00000008',
  programador: process.env.PROGRAMADOR_PIN || '00000016',
};

export const BRANCH_MAIN = 'branch_main';
export const WH_MAIN = 'wh_main';

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class SuiteReporter {
  constructor(outDir, label = 'erp-suite') {
    this.outDir = outDir;
    this.label = label;
    this.results = [];
    this.bugs = [];
    this.warnings = [];
    fs.mkdirSync(outDir, { recursive: true });
  }

  record(group, step, detail, ok = true, severity = 'error') {
    const row = { group, step, detail, ok, severity, at: new Date().toISOString() };
    this.results.push(row);
    const prefix = ok ? 'OK' : (severity === 'bug' ? 'BUG' : 'FAIL');
    console.log(`${prefix} | [${group}] ${step}: ${detail}`);
    if (!ok && severity === 'bug') {
      this.bugs.push(row);
    }
  }

  warn(group, step, detail) {
    const row = { group, step, detail, ok: true, severity: 'warning', at: new Date().toISOString() };
    this.warnings.push(row);
    console.log(`WARN | [${group}] ${step}: ${detail}`);
  }

  summary() {
    const failed = this.results.filter((r) => !r.ok);
    const passed = this.results.length - failed.length;
    const report = {
      label: this.label,
      run_tag: RUN_TAG,
      base: { frontend: FRONTEND_BASE, api: API_BASE },
      totals: {
        passed,
        failed: failed.length,
        warnings: this.warnings.length,
        bugs: this.bugs.length,
        total: this.results.length,
      },
      results: this.results,
      failed,
      bugs: this.bugs,
      warnings: this.warnings,
    };
    const file = path.join(this.outDir, `${this.label}-report.json`);
    fs.writeFileSync(file, JSON.stringify(report, null, 2));
    console.log(`\n=== ${this.label.toUpperCase()} ===`);
    console.log(`RESUMEN: ${passed}/${this.results.length} OK | bugs=${this.bugs.length} | warnings=${this.warnings.length}`);
    if (failed.length) {
      console.log('Fallos:', failed.map((f) => `${f.group}/${f.step}`).join(', '));
    }
    return { report, exitCode: failed.length ? 1 : 0, file };
  }
}

export class ApiSession {
  constructor(label = 'api') {
    this.label = label;
    this.cookies = [];
    this.user = null;
  }

  _cookieHeader() {
    return this.cookies.map((c) => c.split(';')[0]).join('; ');
  }

  _storeCookies(response) {
    const raw = typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie()
      : [response.headers.get('set-cookie')].filter(Boolean);
    for (const line of raw) {
      const first = String(line).split(';')[0];
      const name = first.split('=')[0];
      this.cookies = this.cookies.filter((c) => !c.startsWith(`${name}=`));
      this.cookies.push(first);
    }
  }

  async request(method, apiPath, { json, headers = {}, timeout = 120000 } = {}) {
    const url = `${API_BASE}${apiPath.startsWith('/') ? apiPath : `/${apiPath}`}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const init = {
        method,
        headers: {
          ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(this._cookieHeader() ? { Cookie: this._cookieHeader() } : {}),
          ...headers,
        },
        signal: controller.signal,
      };
      if (json !== undefined) init.body = JSON.stringify(json);
      const response = await fetch(url, init);
      this._storeCookies(response);
      let body = null;
      const text = await response.text();
      if (text) {
        try { body = JSON.parse(text); } catch { body = text; }
      }
      return { status: response.status, ok: response.ok, body, text };
    } finally {
      clearTimeout(timer);
    }
  }

  get(path, opts) { return this.request('GET', path, opts); }
  post(path, json, opts = {}) { return this.request('POST', path, { ...opts, json }); }
  put(path, json, opts = {}) { return this.request('PUT', path, { ...opts, json }); }
  patch(path, json, opts = {}) { return this.request('PATCH', path, { ...opts, json }); }
  delete(path, opts) { return this.request('DELETE', path, opts); }

  async login(pin, userId = null) {
    const payload = userId ? { pin, user_id: userId } : { pin };
    const res = await this.post('/auth/pin/login', payload);
    if (!res.ok) {
      throw new Error(`Login ${this.label} falló: ${res.status} ${String(res.text).slice(0, 300)}`);
    }
    this.user = res.body?.user || res.body || {};
    return this.user;
  }

  async tryLogin(pin, userId = null) {
    try {
      return await this.login(pin, userId);
    } catch {
      return null;
    }
  }

  async createTestSession(role, email, name) {
    const res = await this.post('/test/create-session', { role, email, name });
    if (!res.ok) return null;
    this.user = res.body?.user || { role, email, name };
    return this.user;
  }

  async me() {
    const res = await this.get('/auth/me');
    return res.ok ? res.body : null;
  }
}

export async function waitForApi(timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${API_BASE}/auth/pin/users`, { method: 'GET' });
      if (res.status === 200 || res.status === 401) return true;
    } catch {
      // retry
    }
    await sleep(2000);
  }
  throw new Error(`API no disponible en ${API_BASE}`);
}

export async function loginWithPin(page, pin, targetUrl = `${FRONTEND_BASE}/login`) {
  await page.context().clearCookies();
  await page.goto(`${FRONTEND_BASE}/login`, { waitUntil: 'commit', timeout: 60000 });
  const pinInput = page.locator('input[aria-label="PIN"]');
  const visible = await pinInput.isVisible({ timeout: 10000 }).catch(() => false);
  if (!visible) {
    // Ya autenticado o layout sin PIN
    if (targetUrl && !targetUrl.includes('/login')) {
      await page.goto(targetUrl, { waitUntil: 'commit', timeout: 60000 });
    }
    return !page.url().includes('/login');
  }
  for (const digit of String(pin).split('')) {
    await page.getByRole('button', { name: digit, exact: true }).click();
  }
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 45000 });
  if (targetUrl && !targetUrl.includes('/login')) {
    await page.goto(targetUrl, { waitUntil: 'commit', timeout: 60000 });
  }
  return true;
}

export async function gotoSafe(page, url, { timeout = 60000, retries = 4 } = {}) {
  let lastError;
  for (let i = 0; i <= retries; i += 1) {
    try {
      await page.goto(url, { waitUntil: 'commit', timeout });
      if (!page.url().includes('chrome-error')) return true;
      lastError = new Error(`chrome-error: ${url}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(1500);
  }
  throw lastError;
}

export async function clearSaleDrafts(page) {
  await page.evaluate(() => {
    const keys = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && key.includes('draft_sale')) keys.push(key);
    }
    keys.forEach((k) => window.localStorage.removeItem(k));
  });
}

export async function clearQuoteDrafts(page) {
  await page.evaluate(() => {
    const keys = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && key.includes('draft_quote')) keys.push(key);
    }
    keys.forEach((k) => window.localStorage.removeItem(k));
  });
}

export function pickFirst(rows, predicate = () => true) {
  if (!Array.isArray(rows)) return null;
  return rows.find(predicate) || rows[0] || null;
}

export function round2(n) {
  return Math.round(Number(n || 0) * 100) / 100;
}

export async function expectStatus(res, expected, label) {
  const ok = Array.isArray(expected) ? expected.includes(res.status) : res.status === expected;
  if (!ok) {
    throw new Error(`${label}: esperado ${expected}, obtuvo ${res.status} — ${String(res.text).slice(0, 400)}`);
  }
  return res.body;
}

export function defaultOutDir(name) {
  return path.join(__dirname, '..', '..', 'test-results', name);
}