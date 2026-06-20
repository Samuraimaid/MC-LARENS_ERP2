const http = require('http');
const https = require('https');
const url = require('url');

function fetch(u) {
  return new Promise((resolve, reject) => {
    const parsed = url.parse(u);
    const lib = parsed.protocol === 'https:' ? https : http;
    const opts = { ...parsed, timeout: 10000 };
    const req = lib.get(opts, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
  });
}

(async () => {
  const base = process.env.URL || 'http://localhost:63097';
  const root = base.replace(/\/$/, '') + '/';
  console.log('GET', root);
  try {
    const r = await fetch(root);
    console.log('root status', r.status);
    console.log('root startsWith:', r.body.slice(0, 120).replace(/\n/g, ' '));
  } catch (e) {
    console.error('root fetch error', e.message);
  }

  const scriptPath = base.replace(/\/$/, '') + '/static/js/main.8843d43a.js';
  console.log('GET', scriptPath);
  try {
    const s = await fetch(scriptPath);
    console.log('script status', s.status);
    console.log('script startsWith:', s.body.slice(0, 120).replace(/\n/g, ' '));
  } catch (e) {
    console.error('script fetch error', e.message);
  }
})();
