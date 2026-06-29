const { test, expect } = require("@playwright/test");

const BASE = process.env.FRONTEND_BASE || "http://127.0.0.1:3000";
const PIN_VENTAS = process.env.VENTAS_PIN || "55667788";

async function loginWithPin(page, pin) {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForSelector('input[aria-label="PIN"]', { timeout: 30000 });
  for (const digit of pin.split("")) {
    await page.getByRole("button", { name: digit, exact: true }).click();
  }
  await page.waitForFunction(
    () => !window.location.pathname.includes("/login") && window.location.pathname !== "/",
    null,
    { timeout: 30000 },
  );
}

test("payment plan amount input accepts multi-digit values", async ({ page }) => {
  test.setTimeout(120000);
  await loginWithPin(page, PIN_VENTAS);
  await page.goto(`${BASE}/sales`, { waitUntil: "networkidle" });

  const mixedLabel = page.getByText("Pago mixto", { exact: false }).first();
  if (await mixedLabel.isVisible().catch(() => false)) {
    await mixedLabel.click();
  }

  for (const label of [/Efectivo/i, /Transferencia/i]) {
    const checkbox = page.getByRole("checkbox", { name: label }).first();
    if (await checkbox.isVisible().catch(() => false)) {
      await checkbox.check({ force: true }).catch(() => {});
    }
  }

  const planHeader = page.getByText("Plan de cobro acordado", { exact: false });
  const planVisible = await planHeader.isVisible().catch(() => false);
  if (!planVisible) {
    test.skip(true, "Plan de cobro no visible sin carrito/cliente");
  }

  const amountInput = page.locator('label:has-text("Monto")').locator("..").locator("input").first();
  await amountInput.click();
  await amountInput.fill("");
  await amountInput.pressSequentially("3793.27", { delay: 40 });
  await amountInput.blur();

  const value = (await amountInput.inputValue()).replace(/,/g, "");
  expect(value).toMatch(/3793\.27/);
});