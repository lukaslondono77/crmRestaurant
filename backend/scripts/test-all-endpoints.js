#!/usr/bin/env node

/**
 * Test All Endpoints — Cloudignite Backend
 * Run against a running API server (npm run dev).
 *
 * Usage: node scripts/test-all-endpoints.js [baseUrl]
 * Default baseUrl: http://localhost:8000
 */

const http = require('http');
const https = require('https');

const BASE = process.argv[2] || 'http://localhost:8000';
const baseUrl = new URL(BASE);
const isHttps = baseUrl.protocol === 'https:';
const client = isHttps ? https : http;

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: baseUrl.hostname,
      port: baseUrl.port || (isHttps ? 443 : 80),
      path: path.startsWith('/') ? path : `/${path}`,
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (token) opts.headers['Authorization'] = `Bearer ${token}`;
    const req = client.request(opts, (res) => {
      let data = '';
      res.on('data', (ch) => { data += ch; });
      res.on('end', () => {
        let json;
        try { json = data ? JSON.parse(data) : {}; } catch (_) { json = {}; }
        resolve({ status: res.statusCode, headers: res.headers, data: json, raw: data });
      });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

function ok(name, cond, msg = '') {
  const pass = !!cond;
  console.log(pass ? `  ✅ ${name}` : `  ❌ ${name}${msg ? ': ' + msg : ''}`);
  return pass;
}

async function run() {
  console.log('\n🧪 Test All Endpoints — Cloudignite Backend\n');
  console.log(`   Base URL: ${BASE}\n`);

  let passed = 0;
  let failed = 0;
  let token = null;
  let tenantId = null;

  // --- Health ---
  console.log('1. Health');
  try {
    const h = await request('GET', '/api/healthz');
    if (ok('GET /api/healthz', h.status === 200)) passed++; else failed++;
  } catch (e) {
    console.log(`  ❌ GET /api/healthz: ${e.message}`);
    failed++;
  }

  // --- Auth: Register ---
  console.log('\n2. Auth — Register');
  const email = `test-${Date.now()}@example.com`;
  try {
    const reg = await request('POST', '/api/auth/register', {
      companyName: 'Test Co',
      email,
      password: 'password123',
      firstName: 'Test',
      lastName: 'User'
    });
    const okReg = reg.status === 200 && reg.data.success && reg.data.data && reg.data.data.token;
    if (ok('POST /api/auth/register', okReg)) {
      passed++;
      token = reg.data.data.token;
      tenantId = reg.data.data.tenant?.id ?? reg.data.data.user?.tenantId;
    } else failed++;
  } catch (e) {
    console.log(`  ❌ POST /api/auth/register: ${e.message}`);
    failed++;
  }

  // --- Auth: Login ---
  console.log('\n3. Auth — Login');
  try {
    const login = await request('POST', '/api/auth/login', { email, password: 'password123' });
    const okLogin = login.status === 200 && login.data.success && login.data.data?.token;
    if (ok('POST /api/auth/login', okLogin)) {
      passed++;
      if (!token) token = login.data.data.token;
    } else failed++;
  } catch (e) {
    console.log(`  ❌ POST /api/auth/login: ${e.message}`);
    failed++;
  }

  if (!token) {
    console.log('\n⚠️  No token — skipping authenticated endpoints.\n');
    console.log(`   Passed: ${passed}  Failed: ${failed}\n`);
    process.exit(failed > 0 ? 1 : 0);
  }

  // --- Auth: Me ---
  console.log('\n4. Auth — Me');
  try {
    const me = await request('GET', '/api/auth/me', null, token);
    const okMe = me.status === 200 && me.data.success && me.data.data?.user;
    if (ok('GET /api/auth/me', okMe)) passed++; else failed++;
  } catch (e) {
    console.log(`  ❌ GET /api/auth/me: ${e.message}`);
    failed++;
  }

  // --- Dashboard: Metrics ---
  console.log('\n5. Dashboard — Metrics');
  try {
    const m = await request('GET', '/api/dashboard/metrics', null, token);
    if (m.status !== 200 || !m.data.success) {
      ok('GET /api/dashboard/metrics', false, m.data?.error?.message || `status ${m.status}`);
      failed++;
    } else {
      const d = m.data.data || {};
      const has = (k) => d[k] !== undefined && d[k] !== null;
      ok('GET /api/dashboard/metrics', true);
      passed++;
      if (!ok('metrics.foodCostPercent', typeof d.foodCostPercent === 'number' || has('foodCostDisplay'))) failed++; else passed++;
      if (!ok('metrics.primeCostPercent / primeCost', typeof d.primeCostPercent === 'number' || typeof d.primeCost === 'number' || has('primeCostDisplay'))) failed++; else passed++;
      if (!ok('metrics.lossSummary', has('lossSummary') && typeof d.lossSummary === 'object')) failed++; else passed++;
    }
  } catch (e) {
    console.log(`  ❌ GET /api/dashboard/metrics: ${e.message}`);
    failed++;
  }

  // --- Dashboard: Action Items ---
  console.log('\n6. Dashboard — Action Items');
  try {
    const a = await request('GET', '/api/dashboard/action-items', null, token);
    const d = a.data.data;
    const okA = a.status === 200 && a.data.success && d && (Array.isArray(d) || (Array.isArray(d.items) && typeof d.count === 'number'));
    if (ok('GET /api/dashboard/action-items', okA)) passed++; else failed++;
  } catch (e) {
    console.log(`  ❌ GET /api/dashboard/action-items: ${e.message}`);
    failed++;
  }

  // --- Dashboard: Executive Summary (Owner View) ---
  console.log('\n6b. Dashboard — Executive Summary (Owner View)');
  try {
    const es = await request('GET', '/api/dashboard/executive-summary', null, token);
    const ed = es.data.data || es.data;
    const okEs = es.status === 200 && es.data.success && ed && typeof ed.priorityOne === 'object' && typeof ed.cards === 'object' && typeof ed.period === 'object';
    if (ok('GET /api/dashboard/executive-summary', okEs)) passed++; else failed++;
  } catch (e) {
    console.log(`  ❌ GET /api/dashboard/executive-summary: ${e.message}`);
    failed++;
  }

  // --- Dashboard: Monthly Report ---
  console.log('\n7. Dashboard — Monthly Report');
  try {
    const y = new Date().getFullYear();
    const mo = new Date().getMonth() + 1;
    const r = await request('GET', `/api/dashboard/monthly-report?year=${y}&month=${mo}`, null, token);
    const okR = r.status === 200 && r.data.success;
    if (ok('GET /api/dashboard/monthly-report', okR)) passed++; else failed++;
  } catch (e) {
    console.log(`  ❌ GET /api/dashboard/monthly-report: ${e.message}`);
    failed++;
  }

  // --- Inventory ---
  console.log('\n8. Inventory');
  try {
    const inv = await request('GET', '/api/inventory', null, token);
    const okInv = inv.status === 200 && inv.data.success && inv.data.data && (inv.data.data.items || inv.data.data) !== undefined;
    if (ok('GET /api/inventory', okInv)) passed++; else failed++;
  } catch (e) {
    console.log(`  ❌ GET /api/inventory: ${e.message}`);
    failed++;
  }

  // --- Analytics (smoke) ---
  console.log('\n9. Analytics (smoke)');
  const start = '2025-01-01';
  const end = '2025-12-31';
  for (const [label, path] of [
    ['waste-analysis', `/api/analytics/waste-analysis?startDate=${start}&endDate=${end}`],
    ['product-margins', `/api/analytics/product-margins?startDate=${start}&endDate=${end}`],
    ['trends', '/api/analytics/trends?periodType=weekly&periods=4'],
    ['suppliers', `/api/analytics/suppliers?startDate=${start}&endDate=${end}`],
    ['alerts', '/api/analytics/alerts?daysAhead=7']
  ]) {
    try {
      const resp = await request('GET', path, null, token);
      if (ok(`GET /api/analytics/${label}`, resp.status === 200 && resp.data.success)) passed++; else failed++;
    } catch (e) {
      console.log(`  ❌ GET /api/analytics/${label}: ${e.message}`);
      failed++;
    }
  }

  // --- Square sync alias ---
  console.log('\n10. Square — Sync alias');
  try {
    const sync = await request('POST', '/api/square/sync', {}, token);
    const okSync = sync.status === 200 && sync.data && (sync.data.success || sync.data.data != null);
    if (ok('POST /api/square/sync', okSync)) passed++; else failed++;
  } catch (e) {
    console.log(`  ❌ POST /api/square/sync: ${e.message}`);
    failed++;
  }

  console.log('\n' + '─'.repeat(50));
  console.log(`   Passed: ${passed}   Failed: ${failed}\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
