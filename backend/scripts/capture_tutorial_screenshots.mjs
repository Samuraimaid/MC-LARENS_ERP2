/**
 * Capture real ERP screenshots per role for tutorials.
 * Run inside Playwright docker image with host network:
 *   docker run --rm --network host -v <host_data>:/out mcr.microsoft.com/playwright:v1.49.0-jammy \
 *     bash -lc "cd /tmp && node /out/capture_tutorial_screenshots.mjs"
 *
 * Or copy this file into a container that has playwright + chromium.
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const FRONT = process.env.ERP_FRONT_URL || "http://127.0.0.1:3000";
const API = process.env.ERP_API_BASE || "http://127.0.0.1:8001/api";
const OUT =
  process.env.TUTORIAL_OUT ||
  "/app/backend/data/tutorial-assets/real";

const ROLES = [
  { key: "login", pin: null, routes: [{ name: "login", path: "/login" }] },
  {
    key: "ventas",
    pin: "55667788",
    routes: [
      { name: "ventas-home", path: "/sales" },
      { name: "ventas-sales", path: "/sales" },
      { name: "ventas-clientes", path: "/customers" },
      { name: "ventas-quotations", path: "/quotations" },
    ],
  },
  {
    key: "cajero",
    pin: "11223344",
    routes: [{ name: "cajero-cashier", path: "/cashier" }],
  },
  {
    key: "supervisor",
    pin: "00000003",
    routes: [
      { name: "supervisor-home", path: "/sales" },
      { name: "supervisor-approvals", path: "/approvals" },
      { name: "supervisor-flow-health", path: "/ops/flow-health" },
    ],
  },
  {
    key: "bodegas",
    pin: "00000010",
    routes: [
      { name: "bodegas-dispatch", path: "/dispatch" },
      { name: "bodegas-kds", path: "/kds/bodega" },
    ],
  },
  {
    key: "coord-inst",
    pin: "88112233",
    routes: [
      { name: "coord-inst", path: "/coordinator/instalaciones" },
      { name: "coord-inst-qc", path: "/quality-control" },
    ],
  },
  {
    key: "coord-pol",
    pin: "88223344",
    routes: [{ name: "coord-pol", path: "/coordinator/polarizados" }],
  },
  {
    key: "gerencia",
    pin: "01011990",
    routes: [
      { name: "gerencia-dashboard", path: "/dashboard" },
      { name: "gerencia-tutorials-edit", path: "/help/tutorials" },
      { name: "gerencia-users", path: "/users" },
      { name: "tech-home", path: "/help/tutorials" },
      { name: "tech-wo", path: "/work-orders" },
      { name: "electrico-home", path: "/work-orders" },
      { name: "polarizador-home", path: "/tint-orders" },
      { name: "jefe-home", path: "/sales" },
    ],
  },
];

async function loginWithPin(page, pin) {
  await page.goto(`${FRONT}/login`, { waitUntil: "networkidle", timeout: 90000 });
  // Try common selectors for PIN pad / input
  const pinInput = page.locator('input[type="password"], input[inputmode="numeric"], input[name="pin"]').first();
  if (await pinInput.count()) {
    await pinInput.fill("");
    await pinInput.type(String(pin), { delay: 40 });
  } else {
    // click digit buttons if present
    for (const d of String(pin)) {
      const btn = page.getByRole("button", { name: d, exact: true }).first();
      if (await btn.count()) await btn.click();
      else await page.keyboard.type(d);
    }
  }
  const enter = page.getByRole("button", { name: /entrar|ingresar|login/i }).first();
  if (await enter.count()) await enter.click();
  else await page.keyboard.press("Enter");
  await page.waitForTimeout(2000);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const results = [];
  for (const role of ROLES) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();
    try {
      if (role.pin) {
        await loginWithPin(page, role.pin);
      }
      for (const route of role.routes) {
        const url = route.path.startsWith("http") ? route.path : `${FRONT}${route.path}`;
        try {
          await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
          await page.waitForTimeout(1200);
          // dismiss possible toasts overlays by clicking body
          await page.mouse.click(10, 10).catch(() => {});
          const file = path.join(OUT, `${route.name}.png`);
          await page.screenshot({ path: file, fullPage: false });
          results.push({ ok: true, role: role.key, file, route: route.path });
          console.log("OK", route.name, "->", file);
        } catch (err) {
          results.push({
            ok: false,
            role: role.key,
            route: route.path,
            error: String(err).slice(0, 200),
          });
          console.log("FAIL", route.name, String(err).slice(0, 160));
        }
      }
    } catch (err) {
      console.log("ROLE FAIL", role.key, String(err).slice(0, 200));
    } finally {
      await context.close();
    }
  }
  await browser.close();
  const report = path.join(OUT, "_capture_report.json");
  fs.writeFileSync(report, JSON.stringify(results, null, 2));
  console.log("Report", report, "ok", results.filter((r) => r.ok).length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
