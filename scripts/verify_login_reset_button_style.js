const { chromium } = require('@playwright/test');

(async () => {
  const base = process.env.FRONTEND_BASE || 'http://127.0.0.1:3000';
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(`${base}/login`, { waitUntil: 'load' });
    await page.waitForSelector('[data-testid="pin-reset-session"]', { timeout: 15000 });

    const initialClass = await page.getAttribute('[data-testid="pin-reset-session"]', 'class');

    for (let i = 0; i < 8; i++) {
      await page.click('[data-testid="pin-key-0"]');
    }
    await page.click('[data-testid="pin-submit"]');

    await page.waitForFunction(() => {
      const btn = document.querySelector('[data-testid="pin-reset-session"]');
      return !!btn && /bg-destructive|text-destructive-foreground/.test(btn.className);
    }, null, { timeout: 8000 });

    const errorClass = await page.getAttribute('[data-testid="pin-reset-session"]', 'class');

    console.log(JSON.stringify({
      status: 'PASS',
      initialClass,
      errorClass,
      changedToDestructive: true,
    }));
  } catch (error) {
    console.log(JSON.stringify({
      status: 'FAIL',
      message: error?.message || String(error),
    }));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
