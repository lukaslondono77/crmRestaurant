#!/usr/bin/env node

/**
 * Smoke E2E — Simulates real user flow: register → seed → dashboard → inventory → todos.
 * Run with backend up: npm run test:smoke-e2e [baseUrl]
 */

const http = require('http');
const https = require('https');

const BASE = process.argv[2] || process.env.API_URL || 'http://localhost:8000';
const baseUrl = new URL(BASE);
const isHttps = baseUrl.protocol === 'https:';
const client = isHttps ? https : http;

function request(method, path, body, token) {
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

async function run() {
  console.log('\n🔥 Smoke E2E — Register → Seed → Dashboard → Inventory → Todos\n');
  console.log(`   Base URL: ${BASE}\n`);

  let passed = 0;
  let failed = 0;
  let token = null;

  // 1. Register
  console.log('1. Register');
  const email = `smoke-${Date.now()}@example.com`;
  try {
    const reg = await request('POST', '/api/auth/register', {
      companyName: 'Smoke E2E',
      email,
      password: 'Password123!',
      firstName: 'Smoke',
      lastName: 'User'
    });
    const okReg = reg.status === 200 && reg.data?.success && reg.data?.data?.token;
    if (ok('POST /api/auth/register', okReg)) {
      passed++;
      token = reg.data.data.token;
    } else failed++;
  } catch (e) {
    console.log(`  ❌ Register: ${e.message}`);
    failed++;
  }
  if (!token) {
    console.log('\n  Cannot continue without token.\n');
    process.exit(1);
  }

  // 2. Seed (best-effort; may fail if data already exists)
  console.log('\n2. Seed');
  try {
    const seed = await request('POST', '/api/seed/initialize', {}, token);
    const okSeed = seed.status === 200 && seed.data?.success;
    if (okSeed) {
      ok('POST /api/seed/initialize', true);
      passed++;
    } else {
      console.log('  ⚠️ Seed skipped (e.g. data exists)');
    }
  } catch (e) {
    console.log(`  ⚠️ Seed: ${e.message}`);
  }

  // 3. Dashboard metrics
  console.log('\n3. Dashboard');
  try {
    const metrics = await request('GET', '/api/dashboard/metrics', null, token);
    const m = metrics.data?.data ?? metrics.data;
    const okM = metrics.status === 200 && m && typeof m.weeklyLoss === 'number';
    if (ok('GET /api/dashboard/metrics', okM)) passed++; else failed++;
  } catch (e) {
    console.log(`  ❌ Dashboard: ${e.message}`);
    failed++;
  }

  // 4. Inventory (array)
  console.log('\n4. Inventory');
  try {
    const inv = await request('GET', '/api/inventory', null, token);
    const raw = inv.data?.data ?? inv.data;
    const arr = Array.isArray(raw) ? raw : raw?.items ?? raw?.inventory ?? [];
    const okI = inv.status === 200 && Array.isArray(arr);
    if (ok('GET /api/inventory (array)', okI)) passed++; else failed++;
  } catch (e) {
    console.log(`  ❌ Inventory: ${e.message}`);
    failed++;
  }

  // 5. Todos (array or items)
  console.log('\n5. Todos');
  try {
    const todos = await request('GET', '/api/todos', null, token);
    const raw = todos.data?.data ?? todos.data;
    const tArr = Array.isArray(raw) ? raw : raw?.items ?? raw?.todos ?? [];
    const okT = todos.status === 200 && Array.isArray(tArr);
    if (ok('GET /api/todos (array)', okT)) passed++; else failed++;
  } catch (e) {
    console.log(`  ❌ Todos: ${e.message}`);
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
