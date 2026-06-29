const { test, expect } = require("@playwright/test");

const BASE = process.env.FRONTEND_BASE || "http://127.0.0.1:3000";
const PIN = process.env.TEST_PIN || "01011990";

async function loginWithPin(page, pin) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
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

test("coordinador muestra semáforo de asistencia", async ({ page }) => {
  test.setTimeout(90000);
  await loginWithPin(page, PIN);
  await page.goto(`${BASE}/coordinator/instalaciones`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("coordinator-instalaciones-page")).toBeVisible({ timeout: 30000 });

  const bar = page.getByTestId("attendance-summary-bar");
  await expect(bar).toBeVisible({ timeout: 20000 });
  await expect(bar).toContainText(/Equipo hoy/i);
  await expect(bar).toContainText(/Libres/i);
  await expect(bar).toContainText(/Presentes/i);
  await expect(bar).toContainText(/Ausentes/i);
});