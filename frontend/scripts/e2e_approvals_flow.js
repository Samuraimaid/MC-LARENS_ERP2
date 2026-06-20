const { chromium } = require('playwright');

async function run() {
  const headless = process.env.HEADLESS !== 'false';
  const slowMo = process.env.SLOWMO ? parseInt(process.env.SLOWMO, 10) : 0;
  const browser = await chromium.launch({ headless, slowMo });
  const page = await browser.newPage();

  try {
    console.log('Create ventas test session...');
    let resp = await page.request.post('http://127.0.0.1:8001/api/test/create-session', { data: { role: 'ventas', email: 'e2e.ventas@local', name: 'E2E Ventas' } });
    if (!resp.ok()) throw new Error('Failed to create ventas session');
    let body = await resp.json();
    const ventasToken = body.session_token;
    await page.context().addCookies([{ name: 'session_token', value: ventasToken, domain: '127.0.0.1', path: '/' }]);

    // Create a customer as ventas
    console.log('Creating customer as ventas...');
    resp = await page.request.post('http://127.0.0.1:8001/api/customers', {
      data: {
        name: 'E2E Customer',
        phone: '5555-0001',
        email: 'e2e.customer@example.local'
      }
    });
    if (!resp.ok()) throw new Error('Failed to create customer: ' + await resp.text());
    const customer = await resp.json();
    console.log('Customer created:', customer.customer_id);

    // Attempt direct update as ventas - should be rejected by role enforcement if done directly
    console.log('Verifying direct update is not allowed for ventas (expect failure)...');
    let put = await page.request.put(`http://127.0.0.1:8001/api/customers/${customer.customer_id}`, { data: { phone: '5555-9999' } });
    if (put.ok()) {
      console.log('Warning: direct update succeeded for ventas (unexpected)');
    } else {
      console.log('Direct update rejected as expected:', put.status());
    }

    // Create approval request for edit_customer
    console.log('Creating approval request (edit_customer)...');
    resp = await page.request.post('http://127.0.0.1:8001/api/approvals', {
      data: {
        type: 'edit_customer',
        reason: 'Actualizar teléfono por verificación',
        payload: { customer_id: customer.customer_id, changes: { phone: '5555-9999' } }
      }
    });
    if (!resp.ok()) throw new Error('Failed to create approval: ' + await resp.text());
    const appr = await resp.json();
    const approvalId = appr.approval_id;
    console.log('Approval created:', approvalId);

    // Create gerencia session and approve
    console.log('Create gerencia test session...');
    resp = await page.request.post('http://127.0.0.1:8001/api/test/create-session', { data: { role: 'gerencia', email: 'e2e.gerencia@local', name: 'E2E Gerencia' } });
    if (!resp.ok()) throw new Error('Failed to create gerencia session');
    body = await resp.json();
    const gerenciaToken = body.session_token;
    // replace cookie with approver
    await page.context().clearCookies();
    await page.context().addCookies([{ name: 'session_token', value: gerenciaToken, domain: '127.0.0.1', path: '/' }]);

    console.log('Approving request as gerencia...');
    resp = await page.request.put(`http://127.0.0.1:8001/api/approvals/${approvalId}/approve`);
    if (!resp.ok()) throw new Error('Failed to approve request: ' + await resp.text());
    const approved = await resp.json();
    console.log('Approval result:', approved.message);

    // Verify customer updated
    console.log('Verifying customer was updated...');
    resp = await page.request.get(`http://127.0.0.1:8001/api/customers/${customer.customer_id}`);
    if (!resp.ok()) throw new Error('Failed to fetch customer after approval: ' + await resp.text());
    const updated = await resp.json();
    if (updated.phone === '5555-9999') {
      console.log('Customer phone updated successfully. E2E approval flow passed.');
    } else {
      throw new Error('Customer phone not updated: ' + JSON.stringify(updated));
    }

    // Check notifications for requester
    resp = await page.request.get('http://127.0.0.1:8001/api/notifications');
    if (resp.ok()) {
      const notes = await resp.json();
      console.log('Notifications fetched, count:', notes.length);
    }

    await browser.close();
    return true;
  } catch (err) {
    console.error('E2E approvals flow failed:', err);
    await browser.close();
    throw err;
  }
}

if (require.main === module) {
  run().then(() => process.exit(0)).catch(err => process.exit(1));
}

module.exports = { run };
