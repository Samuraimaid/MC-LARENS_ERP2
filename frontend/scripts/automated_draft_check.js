const { chromium } = require('playwright');

async function run() {
  const headless = process.env.HEADLESS !== 'false';
  const slowMo = process.env.SLOWMO ? parseInt(process.env.SLOWMO, 10) : 0;
  const browser = await chromium.launch({ headless, slowMo });
  const page = await browser.newPage();

  try {
    console.log('Requesting test session from backend...');
    const resp = await page.request.post('http://127.0.0.1:8001/api/test/create-session');
    if (!resp.ok()) throw new Error('Failed to create test session');
    const body = await resp.json();
    const sessionToken = body.session_token;
    console.log('Session token acquired:', !!sessionToken);
    await page.context().addCookies([{ name: 'session_token', value: sessionToken, domain: '127.0.0.1', path: '/' }]);

    console.log('Opening Vehicles page...');
    await page.goto('http://127.0.0.1:3000/vehicles', { waitUntil: 'domcontentloaded' });

    // Cleanup old draft keys to make runs deterministic
    await page.evaluate(() => {
      const prefixes = ['draft_quote_v1_', 'draft_sale_v1_'];
      const exact = ['draft_quote_tabs_v1', 'draft_sale_tabs_v1', 'catalog_open_draft'];
      Object.keys(localStorage).forEach(k => {
        if (prefixes.some(p => k.startsWith(p)) || exact.includes(k)) localStorage.removeItem(k);
      });
      return true;
    });

    // Wait for vehicle cards
    await page.waitForSelector('text=Crear Cotización', { timeout: 10000 });
    console.log('Create Quotation button found, clicking...');

    // Click first Create Quotation button via DOM (avoid overlay interception)
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Crear Cotización'));
      if (btn) btn.click();
    });

    // Wait for navigation to quotations (or timeout)
    await page.waitForURL('**/quotations**', { timeout: 10000 }).catch(() => console.log('Navigation to /quotations may be pending...'));

    // Give time for localStorage to be written
    await page.waitForTimeout(500);

    const quoteKeys = await page.evaluate(() => {
      return Object.keys(localStorage).filter(k => k.startsWith('draft_quote_v1_') || k === 'draft_quote_tabs_v1' || k === 'catalog_open_draft');
    });

    console.log('Quotation localStorage keys:', quoteKeys);

    // Basic assertion: ensure at least one quote draft exists and contains vehicle/customer
    const quoteAssertion = await page.evaluate(() => {
      const key = Object.keys(localStorage).find(k => k.startsWith('draft_quote_v1_'));
      if (!key) return { ok: false, reason: 'no_quote_key' };
      try {
        const obj = JSON.parse(localStorage.getItem(key));
        const hasVehicle = obj && (obj.selectedVehicle || obj.vehicle || obj.vehicle_id || (Array.isArray(obj.items) && obj.items.some(it => it.vehicle_id || it.plate)));
        const hasCustomer = obj && (obj.selectedCustomerId || obj.customer_id || (obj.customer && (obj.customer.id || obj.customer._id)) || obj.client_id);
        return { ok: !!(hasVehicle && hasCustomer), key, hasVehicle: !!hasVehicle, hasCustomer: !!hasCustomer, raw: obj };
      } catch (e) {
        return { ok: false, reason: 'parse_error' };
      }
    });

    if (!quoteAssertion.ok) {
      try {
        console.log('Failed quote draft content:', JSON.stringify(quoteAssertion.raw));
      } catch (e) {
        // ignore
      }
      throw new Error('Quotation draft assertion failed: ' + JSON.stringify(quoteAssertion));
    }

    // Now go back to vehicles and test Create Sale
    console.log('Navigating back to Vehicles...');
    await page.goto('http://127.0.0.1:3000/vehicles', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('text=Crear Venta', { timeout: 10000 });
    console.log('Create Sale button found, clicking...');
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Crear Venta'));
      if (btn) btn.click();
    });
    await page.waitForURL('**/sales**', { timeout: 10000 }).catch(() => console.log('Navigation to /sales may be pending...'));
    await page.waitForTimeout(500);

    const saleKeys = await page.evaluate(() => {
      return Object.keys(localStorage).filter(k => k.startsWith('draft_sale_v1_') || k === 'draft_sale_tabs_v1' || k === 'catalog_open_draft');
    });

    console.log('Sale localStorage keys:', saleKeys);

    const saleAssertion = await page.evaluate(() => {
      const key = Object.keys(localStorage).find(k => k.startsWith('draft_sale_v1_'));
      if (!key) return { ok: false, reason: 'no_sale_key' };
      try {
        const obj = JSON.parse(localStorage.getItem(key));
        const hasVehicle = obj && (obj.selectedVehicle || obj.vehicle || obj.vehicle_id || (Array.isArray(obj.items) && obj.items.some(it => it.vehicle_id || it.plate)));
        const hasCustomer = obj && (obj.selectedCustomerId || obj.customer_id || (obj.customer && (obj.customer.id || obj.customer._id)) || obj.client_id);
        return { ok: !!(hasVehicle && hasCustomer), key, hasVehicle: !!hasVehicle, hasCustomer: !!hasCustomer, raw: obj };
      } catch (e) {
        return { ok: false, reason: 'parse_error' };
      }
    });

    if (!saleAssertion.ok) {
      try {
        console.log('Failed sale draft content:', JSON.stringify(saleAssertion.raw));
      } catch (e) {
        // ignore
      }
      throw new Error('Sale draft assertion failed: ' + JSON.stringify(saleAssertion));
    }

    await browser.close();
    console.log('Automated draft check passed.');
    return { quoteKeys, saleKeys };
  } catch (err) {
    console.error('Error during automated check:', err);
    await browser.close();
    throw err;
  }
}

if (require.main === module) {
  run().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { run };
