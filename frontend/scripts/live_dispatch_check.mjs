import { chromium } from "@playwright/test";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.FRONTEND_BASE || "http://127.0.0.1:3000";
const PIN = process.env.TEST_PIN || "01011990";
const CHROME =
  process.env.CHROME_PATH ||
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const OUT_DIR = path.join(__dirname, "..", "test-results", "dispatch-live");

fs.mkdirSync(OUT_DIR, { recursive: true });

const pageErrors = [];

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  const pinInput = page.locator('input[aria-label="PIN"]');
  if (await pinInput.count()) {
    for (const digit of PIN.split("")) {
      await page.getByRole("button", { name: digit, exact: true }).click();
    }
    await page.waitForFunction(
      () => !window.location.pathname.includes("/login"),
      null,
      { timeout: 30000 }
    );
  }
}

const browser = await chromium.launch({
  headless: true,
  executablePath: CHROME,
});

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on("pageerror", (err) => pageErrors.push(String(err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") pageErrors.push(msg.text());
  });

  await login(page);
  await page.goto(`${BASE}/dispatch`, { waitUntil: "networkidle" });

  await page.waitForSelector('[data-testid="dispatch-page"]', { timeout: 20000 });
  const heading = await page.getByRole("heading", { name: /Despacho de Bodega/i }).isVisible();
  const bodyText = await page.locator("body").innerText();
  const hasTable = (await page.locator("table tbody tr").count()) > 0;

  await page.screenshot({
    path: path.join(OUT_DIR, "dispatch-page.png"),
    fullPage: true,
  });

  const report = {
    ok: heading && bodyText.length > 40 && pageErrors.length === 0,
    heading,
    bodyLength: bodyText.length,
    hasTable,
    pageErrors,
    snippet: bodyText.slice(0, 500),
  };

  fs.writeFileSync(
    path.join(OUT_DIR, "report.json"),
    JSON.stringify(report, null, 2),
    "utf-8"
  );

  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
} finally {
  await browser.close();
}