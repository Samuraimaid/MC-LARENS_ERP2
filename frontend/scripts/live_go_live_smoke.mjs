/**
 * Smoke en vivo: login gerencia + rutas críticas del ERP.
 * Uso: node scripts/live_go_live_smoke.mjs
 */
import { chromium } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.FRONTEND_BASE || "http://127.0.0.1:3000";
const PIN = process.env.TEST_PIN || "01011990";
const CHROME = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const CRITICAL_ROUTES = [
  { path: "/dashboard", label: "Dashboard", testId: null, heading: /dashboard|panel|inicio/i },
  { path: "/sales", label: "Ventas", testId: null, minText: 30 },
  { path: "/cashier", label: "Caja", testId: null, minText: 30 },
  { path: "/quotations", label: "Cotizaciones", testId: null, minText: 30 },
  { path: "/inventory", label: "Inventario", testId: null, minText: 30 },
  { path: "/customers", label: "Clientes", testId: null, minText: 30 },
  { path: "/dispatch", label: "Despacho", testId: "dispatch-page", minText: 40 },
  { path: "/coordinator/instalaciones", label: "Coordinador Inst.", testId: "coordinator-instalaciones-page", minText: 40 },
  { path: "/kds/bodega", label: "KDS Bodega", testId: "kds-warehouse-page", minText: 30 },
  { path: "/kds/instalaciones", label: "KDS Instalaciones", testId: "kds-installations-page", minText: 30 },
  { path: "/kds/polarizados", label: "KDS Polarizados", testId: "kds-tint-page", minText: 30 },
  { path: "/technician", label: "Kiosko Técnico", testId: null, minText: 20 },
  { path: "/human-resources", label: "RRHH", testId: null, minText: 30 },
  { path: "/attendance-clock", label: "Reloj Marcador", testId: null, minText: 20 },
];

async function loginWithPin(page, pin) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForSelector('input[aria-label="PIN"]', { timeout: 30000 });
  for (const digit of String(pin).split("")) {
    await page.getByRole("button", { name: digit, exact: true }).click();
  }
  await page.waitForFunction(
    () => !window.location.pathname.includes("/login"),
    null,
    { timeout: 30000 }
  );
}

const results = { ok: [], failed: [], warnings: [] };

function isBenignError(line) {
  const s = String(line || "").toLowerCase();
  return (
    s.includes("favicon") ||
    s.includes("404") ||
    s.includes("net::err") ||
    s.includes("chunk") && s.includes("loading")
  );
}

const browser = await chromium.launch({
  headless: true,
  executablePath: fs.existsSync(CHROME) ? CHROME : undefined,
});

const page = await browser.newPage();
const consoleErrors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});
page.on("pageerror", (err) => consoleErrors.push(String(err)));

try {
  await loginWithPin(page, PIN);
  results.ok.push({ step: "login", detail: page.url() });

  for (const route of CRITICAL_ROUTES) {
    const routeErrors = [];
    const handler = (msg) => {
      if (msg.type() === "error") routeErrors.push(msg.text());
    };
    page.on("console", handler);

    try {
      await page.goto(`${BASE}${route.path}`, { waitUntil: "networkidle", timeout: 45000 });
      await page.waitForTimeout(800);

      const bodyText = (await page.locator("body").innerText()).trim();
      if (bodyText.length < (route.minText || 20)) {
        throw new Error(`Página casi vacía (${bodyText.length} chars)`);
      }

      if (route.testId) {
        const el = page.getByTestId(route.testId);
        const visible = await el.isVisible().catch(() => false);
        if (!visible) throw new Error(`testid ${route.testId} no visible`);
      }

      const critical = routeErrors.filter((e) => !isBenignError(e));
      if (critical.length) {
        results.warnings.push({
          step: route.label,
          detail: critical.slice(0, 3).join(" | "),
        });
      }

      results.ok.push({ step: route.label, detail: route.path, chars: bodyText.length });
    } catch (err) {
      const shotDir = path.join(__dirname, "..", "test-results", "go-live-smoke");
      fs.mkdirSync(shotDir, { recursive: true });
      const safe = route.path.replace(/\//g, "_");
      await page.screenshot({ path: path.join(shotDir, `${safe}.png`), fullPage: true }).catch(() => {});
      results.failed.push({ step: route.label, path: route.path, detail: String(err.message || err) });
    } finally {
      page.off("console", handler);
    }
  }
} catch (err) {
  results.failed.push({ step: "setup", detail: String(err.message || err) });
} finally {
  await browser.close();
}

const report = {
  at: new Date().toISOString(),
  base: BASE,
  summary: {
    passed: results.ok.length,
    failed: results.failed.length,
    warnings: results.warnings.length,
  },
  results,
};

const outDir = path.join(__dirname, "..", "test-results");
fs.mkdirSync(outDir, { recursive: true });
const reportPath = path.join(outDir, "go-live-smoke-report.json");
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

console.log("GO_LIVE_SMOKE_REPORT", JSON.stringify(report.summary));
console.log("report:", reportPath);
if (results.failed.length) {
  console.log("FAILED:", JSON.stringify(results.failed, null, 2));
  process.exit(1);
}
if (results.warnings.length) {
  console.log("WARNINGS:", JSON.stringify(results.warnings, null, 2));
}
console.log("GO_LIVE_SMOKE_OK");