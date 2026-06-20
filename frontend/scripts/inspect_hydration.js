const { chromium } = require('playwright');

(async () => {
  const url = process.env.URL || 'http://localhost:63097';
  console.log('Inspecting:', url);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', (msg) => {
    console.log('[console]', msg.type(), msg.text());
  });
  page.on('pageerror', (err) => {
    console.log('[pageerror]', err.toString());
  });
  page.on('requestfailed', (req) => {
    console.log('[requestfailed]', req.method(), req.url(), req.failure() && req.failure().errorText);
  });
  page.on('response', (res) => {
    const rt = res.request().resourceType();
    if (rt === 'script' || rt === 'document' || rt === 'xhr' || rt === 'fetch') {
      console.log(`[response] ${res.status()} ${rt} ${res.url()}`);
    }
  });

  try {
    const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
    console.log('[goto] status', resp && resp.status());

    // check specific static asset
    const scriptUrl = url.replace(/\/$/, '') + '/static/js/main.8843d43a.js';
    try {
      const r = await context.request.get(scriptUrl);
      console.log('[asset-check]', scriptUrl, 'status', r.status());
      if (r.ok()) {
        const txt = await r.text();
        console.log('[asset-check] length', txt.length, 'startsWith', txt.slice(0, 60).replace(/\n/g, ' '));
      }
    } catch (e) {
      console.log('[asset-check] failed to fetch script', e && e.message);
    }

    const body = await page.content();
    console.log('--- page html snippet ---');
    console.log(body.slice(0, 1000));

    // see if root node has children (hydration)
    const rootInner = await page.$eval('#root', (el) => el.innerHTML).catch(() => null);
    console.log('[root innerHTML length]', rootInner ? rootInner.length : 'null');

  } catch (e) {
    console.error('Error during inspect:', e && e.message);
  } finally {
    await browser.close();
  }
})();