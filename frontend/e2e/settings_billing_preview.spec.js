const { test, expect } = require("@playwright/test");

const BASE = process.env.FRONTEND_BASE || "http://127.0.0.1:3000";
const PIN = process.env.TEST_PIN || "01011990";

async function loginWithPin(page) {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForSelector('input[aria-label="PIN"]', { timeout: 30000 });
  for (const digit of PIN.split("")) {
    await page.getByRole("button", { name: digit, exact: true }).click();
  }
  await page.waitForURL(/\/(dashboard|sales|workbench|settings)/, { timeout: 30000 });
}

test("settings billing tab and PDF preview work", async ({ page, context }) => {
  test.setTimeout(120000);
  await loginWithPin(page);

  await page.goto(`${BASE}/settings`, { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: "Facturación" }).click();

  await expect(page.getByText("Documentos PDF (facturas y cotizaciones)")).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("Tasa de cambio oficial")).toBeVisible();

  const previewButton = page.getByRole("button", { name: "Factura pendiente" });
  await expect(previewButton).toBeVisible();

  const [previewPage] = await Promise.all([
    context.waitForEvent("page"),
    previewButton.click(),
  ]);

  await previewPage.waitForLoadState("domcontentloaded");
  await previewPage.waitForTimeout(1500);

  const previewUrl = previewPage.url();
  expect(previewUrl.startsWith("blob:")).toBeTruthy();

  const billingResponse = await page.request.get(`${BASE}/api/settings/billing`, {
    failOnStatusCode: false,
  });
  expect(billingResponse.status()).toBe(200);
  const billingJson = await billingResponse.json();
  expect(billingJson.pdf_documents).toBeTruthy();
});