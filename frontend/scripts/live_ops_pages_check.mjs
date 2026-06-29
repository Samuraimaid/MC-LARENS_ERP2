import { chromium } from "@playwright/test";
import fs from "fs";

const BASE = process.env.FRONTEND_BASE || "http://127.0.0.1:3000";
const PIN = process.env.TEST_PIN || "01011990";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const routes = [
  ["/dispatch", "dispatch-page", "Despacho"],
  ["/coordinator/instalaciones", "coordinator-instalaciones-page", "Coordinador"],
  ["/kds/bodega", "kds-warehouse-page", "KDS Bodega"],
  ["/kds/instalaciones", "kds-installations-page", "KDS Inst."],
  ["/kds/polarizados", "kds-tint-page", "KDS Polarizados"],
];

const browser = await chromium.launch({
  headless: true,
  executablePath: fs.existsSync(CHROME) ? CHROME : undefined,
});
const page = await browser.newPage();
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.waitForSelector('input[aria-label="PIN"]', { timeout: 30000 });
for (const d of PIN) await page.getByRole("button", { name: d, exact: true }).click();
await page.waitForFunction(() => !location.pathname.includes("/login"), null, { timeout: 30000 });

const results = [];
for (const [path, tid, label] of routes) {
  try {
    await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
    await page.getByTestId(tid).waitFor({ state: "visible", timeout: 30000 });
    const chars = (await page.locator("body").innerText()).length;
    results.push({ label, path, ok: true, chars });
  } catch (err) {
    results.push({ label, path, ok: false, err: String(err.message || err), url: page.url() });
  }
}
await browser.close();

const failed = results.filter((r) => !r.ok);
console.log("OPS_PAGES_CHECK", JSON.stringify({ passed: results.filter((r) => r.ok).length, failed: failed.length }));
console.log(JSON.stringify(results, null, 2));
process.exit(failed.length ? 1 : 0);