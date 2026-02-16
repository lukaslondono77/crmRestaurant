#!/usr/bin/env node

/**
 * Frontend–Backend Compatibility Tests
 * Verifies array responses and dashboard metrics structure expected by the frontend.
 *
 * Usage: node scripts/test-compatibility.js [baseUrl]
 * Default: http://localhost:8000
 *
 * Requires: Backend running, valid auth (creates test user).
 */

const http = require('http');
const https = require('https');

const BASE = process.argv[2] || process.env.API_URL || 'http://localhost:8000';
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
        resolve({ status: res.statusCode, data: json });
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

function ok(name, cond, msg = '') {
  const pass = !!cond;
  console.log(pass ? `  ✅ ${name}` : `  ❌ ${name}${msg ? ': ' + msg : ''}`);
  return pass;
}

function normalizeArrayResponse(res, key) {
  if (!res || res.status !== 200) return null;
  const envelope = res.data;
  if (!envelope || typeof envelope !== 'object') return null;
  const payload = envelope.data !== undefined ? envelope.data : envelope;
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') {
    if (payload[key] && Array.isArray(payload[key])) return payload[key];
    for (const k of ['invoices', 'reports', 'wasteRecords', 'items']) {
      if (Array.isArray(payload[k])) return payload[k];
    }
  }
  return null;
}

async function run() {
  console.log('\n🔗 Frontend–Backend Compatibility Tests\n');
  console.log(`   Base URL: ${BASE}\n`);

  let passed = 0;
  let failed = 0;
  let token = null;

  const email = `compat-${Date.now()}@example.com`;
  try {
    const reg = await request('POST', '/api/auth/register', {
      companyName: 'Compat Test',
      email,
      password: 'Password123!',
      firstName: 'Compat',
      lastName: 'User'
    });
    if (reg.status !== 200 || !reg.data?.success || !reg.data?.data?.token) {
      console.error('  ❌ Register failed');
      process.exit(1);
    }
    token = reg.data.data.token;
  } catch (e) {
    console.error('  ❌ Auth setup failed:', e.message);
    process.exit(1);
  }

  // --- 1. GET /invoices returns array ---
  console.log('1. GET /invoices — array response');
  try {
    const r = await request('GET', '/api/invoices', null, token);
    const arr = normalizeArrayResponse(r, 'invoices') ?? (Array.isArray((r.data?.data ?? r.data)) ? (r.data?.data ?? r.data) : null);
    const pass = r.status === 200 && Array.isArray(arr);
    if (ok('Invoices endpoint returns array', pass, pass ? '' : 'data or data.invoices must be array')) passed++; else failed++;
  } catch (e) {
    console.log(`  ❌ Invoices: ${e.message}`);
    failed++;
  }

  // --- 2. GET /pos/reports returns array ---
  console.log('\n2. GET /pos/reports — array response');
  try {
    const r = await request('GET', '/api/pos/reports', null, token);
    const arr = normalizeArrayResponse(r, 'reports') ?? (Array.isArray((r.data?.data ?? r.data)) ? (r.data?.data ?? r.data) : null);
    const pass = r.status === 200 && Array.isArray(arr);
    if (ok('POS reports endpoint returns array', pass, pass ? '' : 'data or data.reports must be array')) passed++; else failed++;
  } catch (e) {
    console.log(`  ❌ POS reports: ${e.message}`);
    failed++;
  }

  // --- 3. GET /waste returns array ---
  console.log('\n3. GET /waste — array response');
  try {
    const r = await request('GET', '/api/waste', null, token);
    const arr = normalizeArrayResponse(r, 'wasteRecords') ?? (Array.isArray((r.data?.data ?? r.data)) ? (r.data?.data ?? r.data) : null);
    const pass = r.status === 200 && Array.isArray(arr);
    if (ok('Waste endpoint returns array', pass, pass ? '' : 'data or data.wasteRecords must be array')) passed++; else failed++;
  } catch (e) {
    console.log(`  ❌ Waste: ${e.message}`);
    failed++;
  }

  // --- 4. GET /dashboard/metrics has required fields ---
  console.log('\n4. GET /dashboard/metrics — required fields');
  try {
    const r = await request('GET', '/api/dashboard/metrics', null, token);
    const m = (r.data && (r.data.data !== undefined ? r.data.data : r.data)) || null;
    const hasLoss = m && typeof m === 'object' && 'lossSummary' in m;
    const hasBreakdown = m && typeof m === 'object' && 'savingsBreakdown' in m;
    const hasFoodDisplay = m && typeof m === 'object' && 'foodCostDisplay' in m;
    const hasWasteDisplay = m && typeof m === 'object' && 'wasteDisplay' in m;
    const pass = r.status === 200 && hasLoss && hasBreakdown && hasFoodDisplay && hasWasteDisplay;
    if (ok('Dashboard metrics has required fields', pass,
      pass ? '' : `status=${r.status} missing: lossSummary=${hasLoss} savingsBreakdown=${hasBreakdown} foodCostDisplay=${hasFoodDisplay} wasteDisplay=${hasWasteDisplay}`)) passed++; else failed++;
  } catch (e) {
    console.log(`  ❌ Dashboard metrics: ${e.message}`);
    failed++;
  }

  // --- 5. POST /square/sync (alias) ---
  console.log('\n5. POST /square/sync — alias for sync-today');
  try {
    const r = await request('POST', '/api/square/sync', null, token);
    const pass = r.status === 200 && (r.data?.success === true || (r.data?.data && !r.data?.error));
    if (ok('Square /sync alias responds', pass)) passed++; else failed++;
  } catch (e) {
    console.log(`  ❌ Square /sync: ${e.message}`);
    failed++;
  }

  console.log('\n' + '─'.repeat(50));
  console.log(`  Passed: ${passed}  Failed: ${failed}`);
  console.log('─'.repeat(50) + '\n');
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
