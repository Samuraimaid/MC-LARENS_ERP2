const { chromium } = require('playwright');

async function main() {
  const baseUrl = process.env.FRONTEND_BASE || 'http://127.0.0.1:3000';
  const backendBase = process.env.BACKEND_BASE || 'http://127.0.0.1:8001';
  const loginPin = process.env.TOPCAR_LOGIN_PIN || '23052026';
  const userId = process.env.TOPCAR_USER_ID || 'user_f85c5337f602';

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ baseURL: baseUrl });

  try {
    const page = await context.newPage();
    await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 30000 });

    const loginOnce = async () => page.evaluate(async ({ userId, loginPin }) => {
      const resp = await fetch('/api/auth/pin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, pin: loginPin }),
      });
      const body = await resp.text();
      return { status: resp.status, body };
    }, { userId, loginPin });

    let loginResult = await loginOnce();

    if (loginResult.status !== 200) {
      const sessionResp = await fetch(`${backendBase}/api/test/create-session`, {
        method: 'POST',
      });
      if (!sessionResp.ok) {
        throw new Error(`No se pudo crear sesión admin de prueba: ${sessionResp.status}`);
      }
      const sessionJson = await sessionResp.json();
      const sessionToken = sessionJson.session_token;
      if (!sessionToken) {
        throw new Error('No se recibió session_token para reset de PIN TopCar.');
      }

      const resetResp = await fetch(`${backendBase}/api/users/${userId}/login-pin`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session_token=${sessionToken}`,
        },
        body: JSON.stringify({ new_pin: loginPin }),
      });
      if (!resetResp.ok) {
        const resetBody = await resetResp.text();
        throw new Error(`No se pudo resetear PIN TopCar: ${resetResp.status} ${resetBody}`);
      }

      loginResult = await loginOnce();
    }

    if (loginResult.status !== 200) {
      throw new Error(`Login API falló: ${loginResult.status} ${loginResult.body}`);
    }

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1000);

    const logoSrc = await page.getAttribute('img[src*="topcar-logo"]', 'src');
    if (!logoSrc || !logoSrc.includes('topcar-logo.png')) {
      throw new Error('No se encontró logo TopCar aplicado en la UI.');
    }

    const faviconHref = await page.evaluate(() => {
      const el = document.querySelector("link[rel='icon']");
      return el ? el.getAttribute('href') || '' : '';
    });

    if (!faviconHref.includes('topcar-favicon-32.png')) {
      throw new Error(`Favicon TopCar no aplicado. href actual: ${faviconHref || '(vacío)'}`);
    }

    console.log('OK branding TopCar aplicado');
    console.log(`logo=${logoSrc}`);
    console.log(`favicon=${faviconHref}`);
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch((err) => {
  console.error(`FAIL verify_topcar_branding: ${err.message}`);
  process.exit(1);
});
