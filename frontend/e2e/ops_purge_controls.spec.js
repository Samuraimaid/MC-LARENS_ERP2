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

test.describe("Controles de limpieza (gerencia)", () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(90000);
    await loginWithPin(page, PIN);
  });

  test("coordinador muestra botón limpiar cola", async ({ page }) => {
    await page.goto(`${BASE}/coordinator/instalaciones`, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("coordinator-instalaciones-page")).toBeVisible({ timeout: 30000 });
    const clearBtn = page.getByTestId("clear-queue-instalaciones");
    await expect(clearBtn).toBeVisible({ timeout: 15000 });
    await expect(clearBtn).toContainText(/Limpiar/i);
  });

  test("despacho muestra botón limpiar cola", async ({ page }) => {
    await page.goto(`${BASE}/dispatch`, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("dispatch-page")).toBeVisible({ timeout: 30000 });
    const clearBtn = page.getByTestId("dispatch-clear-queue");
    await expect(clearBtn).toBeVisible({ timeout: 15000 });
    await expect(clearBtn).toContainText(/Limpiar/i);
  });

  test("KDS polarizados muestra botón limpiar cola", async ({ page }) => {
    await page.goto(`${BASE}/kds/polarizados`, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("kds-tint-page")).toBeVisible({ timeout: 30000 });
    const clearBtn = page.getByTestId("kds-tint-clear-queue");
    await expect(clearBtn).toBeVisible({ timeout: 15000 });
    await expect(clearBtn).toContainText(/Limpiar/i);
  });
});