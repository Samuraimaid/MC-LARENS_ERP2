import { chromium } from '@playwright/test';

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
});
const page = await browser.newPage();
await page.goto('http://127.0.0.1:3000/workbench?tab=sales');
await page.locator('input[aria-label="PIN"]').waitFor();
for (const d of '01011990') await page.getByRole('button', { name: d, exact: true }).click();
await page.waitForURL(/workbench/);
await page.waitForSelector('nav[aria-label="Progreso del formulario"]');
const input = page.locator('input[placeholder*="teléfono"]').first();
await input.waitFor({ state: 'visible', timeout: 20000 });
for (const t of ['alvaro', 'a']) {
  await input.fill(t);
  await page.waitForTimeout(800);
  if (await page.locator('[data-index="0"]').count()) {
    await page.locator('[data-index="0"]').click();
    break;
  }
}
await page.waitForTimeout(1000);
console.log('before-cambiar para-llevar:', await page.getByRole('button', { name: /Para llevar/i }).count());
const envioCard = page.locator('div').filter({ hasText: /^Con envío incluido/ }).first();
const cambiarEnvio = envioCard.getByRole('button', { name: /Cambiar/i });
console.log('cambiar-envio:', await cambiarEnvio.count());
if (await cambiarEnvio.count()) {
  await cambiarEnvio.click();
  await page.waitForTimeout(800);
}
console.log('after-cambiar para-llevar:', await page.getByRole('button', { name: /Para llevar/i }).count());
const lines = (await page.locator('body').innerText()).split('\n').filter((l) => /Paso 2|Para llevar|Con envío|Instalado/i.test(l));
console.log('LINES:', lines.join(' | '));
await browser.close();