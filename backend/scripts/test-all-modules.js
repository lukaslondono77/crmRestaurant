#!/usr/bin/env node

/**
 * Test All Module Connections
 * Registers a user, then hits each module endpoint with the token.
 *
 * Usage: node scripts/test-all-modules.js [baseUrl]
 * Default: http://localhost:8000
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
        resolve({ status: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 300, data: json });
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

const MODULES = [
  { name: 'Dashboard metrics', method: 'GET', path: '/api/dashboard/metrics' },
  { name: 'Action items', method: 'GET', path: '/api/dashboard/action-items' },
  { name: 'Inventory', method: 'GET', path: '/api/inventory' },
  { name: 'Waste', method: 'GET', path: '/api/waste' },
  { name: 'Invoices', method: 'GET', path: '/api/invoices' },
  { name: 'POS reports', method: 'GET', path: '/api/pos/reports' },
  { name: 'Todos', method: 'GET', path: '/api/todos' },
  { name: 'Calendar events', method: 'GET', path: '/api/calendar/events' },
  { name: 'Contacts', method: 'GET', path: '/api/contacts' },
  { name: 'Chat conversations', method: 'GET', path: '/api/chat/conversations' },
  { name: 'Emails', method: 'GET', path: '/api/emails' },
  { name: 'Kanban boards', method: 'GET', path: '/api/kanban/boards' },
  { name: 'File folders', method: 'GET', path: '/api/files/folders' },
  { name: 'E‑commerce products', method: 'GET', path: '/api/ecommerce/products' },
  { name: 'CRM leads', method: 'GET', path: '/api/crm/leads' },
  { name: 'Projects', method: 'GET', path: '/api/projects/projects' },
  { name: 'LMS courses', method: 'GET', path: '/api/lms/courses' },
  { name: 'Helpdesk tickets', method: 'GET', path: '/api/helpdesk/tickets' },
  { name: 'HR employees', method: 'GET', path: '/api/hr/employees' },
  { name: 'Events', method: 'GET', path: '/api/events/events' },
  { name: 'Social posts', method: 'GET', path: '/api/social/posts' },
  { name: 'Profile', method: 'GET', path: '/api/users/profile' }
];

async function run() {
  console.log('\n📡 Test All Module Connections\n');
  console.log(`   Base URL: ${BASE}\n`);

  let token;
  try {
    const reg = await request('POST', '/api/auth/register', {
      companyName: 'Module Test',
      email: `modules-${Date.now()}@example.com`,
      password: 'Password123!',
      firstName: 'Mod',
      lastName: 'Test'
    });
    if (!reg.ok || !reg.data?.data?.token) {
      console.error('❌ Register failed:', reg.status, reg.data?.error?.message || reg.data?.message);
      process.exit(1);
    }
    token = reg.data.data.token;
  } catch (e) {
    console.error('❌ Auth setup failed:', e.message);
    process.exit(1);
  }

  let passed = 0;
  let failed = 0;

  for (const m of MODULES) {
    try {
      const r = await request(m.method, m.path, null, token);
      const ok = r.ok;
      if (ok) passed++; else failed++;
      console.log(ok ? `  ✅ ${m.name}` : `  ❌ ${m.name} (${r.status})`);
    } catch (e) {
      failed++;
      console.log(`  ❌ ${m.name} (${e.message})`);
    }
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
