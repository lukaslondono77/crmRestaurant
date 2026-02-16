#!/usr/bin/env node

/**
 * Post-Deployment Verification — Cloudignite Backend
 * Run against a deployed API (local or production).
 *
 * Usage: node scripts/verify-deployment.js [baseURL]
 * Example: node scripts/verify-deployment.js https://api.yourdomain.com
 * Env: API_URL (used if baseURL not passed). Default: http://localhost:8000
 *
 * Exit code: 0 if all critical checks pass, 1 otherwise.
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.argv[2] || process.env.API_URL || 'http://localhost:8000';
const baseUrl = new URL(BASE_URL);
const isHttps = baseUrl.protocol === 'https:';
const client = isHttps ? https : http;

function request(method, pathname, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: baseUrl.hostname,
      port: baseUrl.port || (isHttps ? 443 : 80),
      path: pathname.startsWith('/') ? pathname : `/${pathname}`,
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
        resolve({ status: res.statusCode, data: json, raw: data });
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Request timeout')); });
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

async function createTestUser() {
  const email = `deploy-verify-${Date.now()}@deployment.local`;
  const reg = await request('POST', '/api/auth/register', {
    companyName: 'Deployment Verify',
    email,
    password: 'VerifyPass123!',
    firstName: 'Verify',
    lastName: 'User'
  });
  if (reg.status !== 200 || !reg.data.success || !reg.data.data?.token) {
    throw new Error(reg.data?.error?.message || `Register returned ${reg.status}`);
  }
  return { token: reg.data.data.token, email };
}

async function verifyDeployment() {
  const results = { passed: 0, failed: 0, warnings: 0, details: [] };

  // 1. API Server Reachable
  try {
    const health = await request('GET', '/api/healthz');
    if (health.status === 200) {
      results.passed++;
      results.details.push({ test: 'API Server Reachable', status: 'PASS' });
    } else {
      results.failed++;
      results.details.push({ test: 'API Server Reachable', status: 'FAIL', error: `Status ${health.status}` });
    }
  } catch (e) {
    results.failed++;
    results.details.push({ test: 'API Server Reachable', status: 'FAIL', error: e.message });
  }

  // 2. Database Connectivity (detailed health)
  try {
    const res = await request('GET', '/api/healthz?detailed=1');
    const data = res.data;
    const dbOk = data?.database === 'connected' || data?.database === true;
    if (res.status === 200 && dbOk) {
      results.passed++;
      results.details.push({ test: 'Database Connectivity', status: 'PASS' });
    } else {
      results.failed++;
      results.details.push({
        test: 'Database Connectivity',
        status: 'FAIL',
        error: data?.database ? `Unexpected: ${data.database}` : 'Detailed health failed'
      });
    }
  } catch (e) {
    results.failed++;
    results.details.push({ test: 'Database Connectivity', status: 'FAIL', error: e.message });
  }

  // 3. Authentication Flow (register + /me)
  try {
    const reg = await request('POST', '/api/auth/register', {
      companyName: 'Deployment Test',
      email: `test-${Date.now()}@deployment.local`,
      password: 'TestPassword123!',
      firstName: 'Test',
      lastName: 'User'
    });
    const token = reg.data?.data?.token;
    const regOk = (reg.status === 200 || reg.status === 201) && reg.data?.success && token;
    if (!regOk) {
      results.failed++;
      results.details.push({
        test: 'Authentication Flow',
        status: 'FAIL',
        error: reg.data?.error?.message || `Register returned ${reg.status}`
      });
    } else {
      const me = await request('GET', '/api/auth/me', null, token);
      if (me.status === 200 && me.data?.success && me.data?.data?.user) {
        results.passed++;
        results.details.push({ test: 'Authentication Flow', status: 'PASS' });
      } else {
        results.failed++;
        results.details.push({
          test: 'Authentication Flow',
          status: 'FAIL',
          error: me.data?.error?.message || `/me returned ${me.status}`
        });
      }
    }
  } catch (e) {
    results.failed++;
    results.details.push({ test: 'Authentication Flow', status: 'FAIL', error: e.message });
  }

  // 4. Upload directories (relative to backend root)
  try {
    const backendRoot = path.join(__dirname, '..');
    const dirs = [
      path.join(backendRoot, 'uploads'),
      path.join(backendRoot, 'uploads', 'invoices'),
      path.join(backendRoot, 'uploads', 'pos'),
      path.join(backendRoot, 'uploads', 'waste')
    ];
    const missing = dirs.filter((d) => !fs.existsSync(d));
    if (missing.length === 0) {
      results.passed++;
      results.details.push({ test: 'Upload Directories', status: 'PASS' });
    } else {
      results.warnings++;
      results.details.push({
        test: 'Upload Directories',
        status: 'WARNING',
        message: `Missing: ${missing.map((d) => path.relative(backendRoot, d)).join(', ')}. Create with: mkdir -p uploads/{invoices,pos,waste}`
      });
    }
  } catch (e) {
    results.warnings++;
    results.details.push({ test: 'Upload Directories', status: 'WARNING', error: e.message });
  }

  // 5. Critical endpoints (with auth)
  try {
    const { token } = await createTestUser();
    const start = '2024-01-01';
    const end = '2024-12-31';
    const endpoints = [
      '/api/dashboard/metrics',
      '/api/inventory',
      `/api/analytics/product-margins?startDate=${start}&endDate=${end}`,
      '/api/analytics/alerts?daysAhead=7'
    ];
    let okCount = 0;
    for (const ep of endpoints) {
      try {
        const r = await request('GET', ep, null, token);
        if (r.status === 200 && r.data?.success !== false) okCount++;
      } catch (_) { /* skip */ }
    }
    if (okCount === endpoints.length) {
      results.passed++;
      results.details.push({ test: 'Critical Endpoints', status: 'PASS', checked: endpoints.length });
    } else {
      results.failed++;
      results.details.push({
        test: 'Critical Endpoints',
        status: 'FAIL',
        error: `${okCount}/${endpoints.length} endpoints responded OK`
      });
    }
  } catch (e) {
    results.failed++;
    results.details.push({ test: 'Critical Endpoints', status: 'FAIL', error: e.message });
  }

  return results;
}

function generateReport(results) {
  const sep = '='.repeat(60);
  console.log('\n' + sep);
  console.log('DEPLOYMENT VERIFICATION REPORT');
  console.log(sep);
  console.log(`API URL: ${BASE_URL}`);
  console.log(`Time: ${new Date().toISOString()}`);
  console.log('\nSUMMARY:');
  console.log(`  Passed:  ${results.passed}`);
  console.log(`  Failed:  ${results.failed}`);
  console.log(`  Warnings: ${results.warnings}`);
  console.log(`  Overall: ${results.failed === 0 ? '✅ PASS' : '❌ FAIL'}`);
  console.log('\nDETAILS:');
  for (const d of results.details) {
    const icon = d.status === 'PASS' ? '✅' : d.status === 'FAIL' ? '❌' : '⚠️';
    console.log(`  ${icon} ${d.test}`);
    if (d.error) console.log(`      Error: ${d.error}`);
    if (d.message) console.log(`      Message: ${d.message}`);
    if (d.checked != null) console.log(`      Checked: ${d.checked} endpoints`);
  }
  console.log('\n' + sep);
}

async function main() {
  console.log('\n🔍 Cloudignite — Post-Deployment Verification\n');
  console.log(`   Target: ${BASE_URL}\n`);
  try {
    const results = await verifyDeployment();
    generateReport(results);
    process.exit(results.failed === 0 ? 0 : 1);
  } catch (e) {
    console.error('\n❌ Verification failed:', e.message);
    process.exit(1);
  }
}

main();
