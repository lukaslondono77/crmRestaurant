#!/usr/bin/env node

/**
 * Test Authentication Flow
 * Verifies register → token → /auth/me.
 *
 * Usage: node scripts/test-auth-flow.js [baseUrl]
 * Default: http://localhost:8000
 */

const http = require('http');
const https = require('https');

const BASE = process.argv[2] || process.env.API_URL || 'http://localhost:8000';
const baseUrl = new URL(BASE);
const isHttps = baseUrl.protocol === 'https:';
const client = isHttps ? https : http;

function request(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: baseUrl.hostname,
      port: baseUrl.port || (isHttps ? 443 : 80),
      path: path.startsWith('/') ? path : `/${path}`,
      method,
      headers: { 'Content-Type': 'application/json', ...headers }
    };
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

async function testAuthFlow() {
  console.log('\n🔐 Test Authentication Flow\n');
  console.log(`   Base URL: ${BASE}\n`);

  const email = `test-${Date.now()}@example.com`;
  const payload = {
    companyName: 'Test Company',
    email,
    password: 'Password123!',
    firstName: 'Test',
    lastName: 'User'
  };

  try {
    const reg = await request('POST', '/api/auth/register', payload);
    if (reg.status !== 200 && reg.status !== 201) {
      console.error('❌ Register failed:', reg.status, reg.data);
      process.exit(1);
    }
    if (!reg.data.success || !reg.data.data || !reg.data.data.token) {
      console.error('❌ Register response missing token:', reg.data);
      process.exit(1);
    }
    const token = reg.data.data.token;
    console.log('✅ Register successful, token received');

    const me = await request('GET', '/api/auth/me', null, { Authorization: `Bearer ${token}` });
    if (me.status !== 200) {
      console.error('❌ /auth/me failed:', me.status, me.data);
      process.exit(1);
    }
    if (!me.data.success || !me.data.data || !me.data.data.user) {
      console.error('❌ /auth/me missing user:', me.data);
      process.exit(1);
    }
    console.log('✅ /auth/me successful, user:', me.data.data.user.email || me.data.data.user.id);

    console.log('\n✅ Auth flow OK\n');
    process.exit(0);
  } catch (e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  }
}

testAuthFlow();
