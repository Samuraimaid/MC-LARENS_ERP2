const { test, expect } = require("@playwright/test");
const path = require("path");

const BASE = process.env.FRONTEND_BASE || "http://127.0.0.1:3000";
const PIN = process.env.TEST_PIN || "01011990";

async function loginWithPin(page, pin) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
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

test("dispatch page renders with cancelled rows present", async ({ page }) => {
  test.setTimeout(90000);

  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(String(err)));

  await loginWithPin(page, PIN);
  await page.goto(`${BASE}/dispatch`, { waitUntil: "networkidle" });

  await expect(page.getByTestId("dispatch-page")).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole("heading", { name: /Despacho de Bodega/i })).toBeVisible();

  const bodyText = await page.locator("body").innerText();
  expect(bodyText.length).toBeGreaterThan(40);
  expect(bodyText.toLowerCase()).toContain("despacho");

  const screenshotPath = path.join(
    __dirname,
    "..",
    "test-results",
    "dispatch-live.png"
  );
  await page.screenshot({ path: screenshotPath, fullPage: true });

  const criticalErrors = consoleErrors.filter(
    (line) =>
      !line.includes("favicon") &&
      !line.includes("404") &&
      !line.includes("net::ERR")
  );
  expect(criticalErrors).toEqual([]);
});