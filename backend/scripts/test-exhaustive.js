#!/usr/bin/env node

/**
 * Exhaustive API tests: CRUD per entity, cost-control flow, all GET endpoints.
 * Output: results JSON + reporte-pruebas.html (in backend/).
 *
 * Usage: node scripts/test-exhaustive.js [baseUrl]
 * Backend must be running on :8000.
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const BASE = process.argv[2] || process.env.API_URL || 'http://localhost:8000';
const baseUrl = new URL(BASE);
const isHttps = baseUrl.protocol === 'https:';
const client = isHttps ? https : http;

const results = { start: new Date().toISOString(), passed: 0, failed: 0, tests: [], fixes: [] };

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
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('timeout')); });
    if (body != null) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

function record(name, ok, detail = '') {
  results.tests.push({ name, ok, detail });
  if (ok) results.passed++; else results.failed++;
}

async function crudTodo(token) {
  const entity = 'Todo';
  let id;
  try {
    const create = await request('POST', '/api/todos', { taskName: 'Exhaustive test task', priority: 'medium', status: 'pending' }, token);
    if (!create.ok) { record(`${entity} CREATE`, false, create.data?.error?.message || create.data?.message); return; }
    id = create.data?.data?.id ?? create.data?.id;
    record(`${entity} CREATE`, !!id);

    const read = await request('GET', `/api/todos/${id}`, null, token);
    record(`${entity} READ`, read.ok, read.ok ? '' : read.data?.error?.message);

    const update = await request('PUT', `/api/todos/${id}`, { status: 'in_progress' }, token);
    record(`${entity} UPDATE`, update.ok, update.ok ? '' : update.data?.error?.message);

    const del = await request('DELETE', `/api/todos/${id}`, null, token);
    record(`${entity} DELETE`, del.ok, del.ok ? '' : del.data?.error?.message);
  } catch (e) {
    record(`${entity} CRUD`, false, e.message);
  }
}

async function crudContact(token) {
  const entity = 'Contact';
  let id;
  try {
    const create = await request('POST', '/api/contacts', {
      firstName: 'Exhaustive',
      lastName: 'Test',
      email: `exhaustive-${Date.now()}@test.com`,
      company: 'Test Co'
    }, token);
    if (!create.ok) { record(`${entity} CREATE`, false, create.data?.error?.message || create.data?.message); return; }
    id = create.data?.data?.id ?? create.data?.id;
    record(`${entity} CREATE`, !!id);

    const read = await request('GET', `/api/contacts/${id}`, null, token);
    record(`${entity} READ`, read.ok, read.ok ? '' : read.data?.error?.message);

    const update = await request('PUT', `/api/contacts/${id}`, { company: 'Updated Co' }, token);
    record(`${entity} UPDATE`, update.ok, update.ok ? '' : update.data?.error?.message);

    const del = await request('DELETE', `/api/contacts/${id}`, null, token);
    record(`${entity} DELETE`, del.ok, del.ok ? '' : del.data?.error?.message);
  } catch (e) {
    record(`${entity} CRUD`, false, e.message);
  }
}

async function crudCalendar(token) {
  const entity = 'Calendar event';
  let id;
  const start = new Date();
  const end = new Date(start.getTime() + 3600000);
  try {
    const create = await request('POST', '/api/calendar/events', {
      title: 'Exhaustive test event',
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      allDay: false
    }, token);
    if (!create.ok) { record(`${entity} CREATE`, false, create.data?.error?.message || create.data?.message); return; }
    id = create.data?.data?.id ?? create.data?.id;
    record(`${entity} CREATE`, !!id);

    const read = await request('GET', `/api/calendar/events/${id}`, null, token);
    record(`${entity} READ`, read.ok, read.ok ? '' : read.data?.error?.message);

    const update = await request('PUT', `/api/calendar/events/${id}`, { title: 'Updated event' }, token);
    record(`${entity} UPDATE`, update.ok, update.ok ? '' : update.data?.error?.message);

    const del = await request('DELETE', `/api/calendar/events/${id}`, null, token);
    record(`${entity} DELETE`, del.ok, del.ok ? '' : del.data?.error?.message);
  } catch (e) {
    record(`${entity} CRUD`, false, e.message);
  }
}

async function crudCrmLead(token) {
  const entity = 'CRM Lead';
  let id;
  try {
    const create = await request('POST', '/api/crm/leads', {
      firstName: 'Exhaustive',
      lastName: 'Lead',
      email: `lead-${Date.now()}@test.com`,
      status: 'new',
      source: 'test'
    }, token);
    if (!create.ok) { record(`${entity} CREATE`, false, create.data?.error?.message || create.data?.message); return; }
    id = create.data?.data?.id ?? create.data?.id;
    record(`${entity} CREATE`, !!id);

    const read = await request('GET', `/api/crm/leads/${id}`, null, token);
    record(`${entity} READ`, read.ok, read.ok ? '' : read.data?.error?.message);

    const update = await request('PUT', `/api/crm/leads/${id}`, { status: 'contacted' }, token);
    record(`${entity} UPDATE`, update.ok, update.ok ? '' : update.data?.error?.message);

    const del = await request('DELETE', `/api/crm/leads/${id}`, null, token);
    record(`${entity} DELETE`, del.ok, del.ok ? '' : del.data?.error?.message);
  } catch (e) {
    record(`${entity} CRUD`, false, e.message);
  }
}

async function costControlFlow(token) {
  const endpoints = [
    ['GET /api/dashboard/metrics', 'GET', '/api/dashboard/metrics'],
    ['GET /api/dashboard/action-items', 'GET', '/api/dashboard/action-items'],
    ['GET /api/dashboard/monthly-report', 'GET', '/api/dashboard/monthly-report'],
    ['GET /api/analytics/food-cost', 'GET', '/api/analytics/food-cost?startDate=2024-01-01&endDate=2024-12-31'],
    ['GET /api/analytics/waste-analysis', 'GET', '/api/analytics/waste-analysis'],
    ['GET /api/analytics/product-margins', 'GET', '/api/analytics/product-margins?startDate=2024-01-01&endDate=2024-12-31'],
    ['GET /api/analytics/trends', 'GET', '/api/analytics/trends'],
    ['GET /api/analytics/alerts', 'GET', '/api/analytics/alerts'],
    ['GET /api/inventory', 'GET', '/api/inventory'],
    ['GET /api/waste', 'GET', '/api/waste'],
    ['GET /api/invoices', 'GET', '/api/invoices'],
    ['GET /api/pos/reports', 'GET', '/api/pos/reports']
  ];
  for (const [name, method, p] of endpoints) {
    try {
      const r = await request(method, p, null, token);
      record(name, r.ok, r.ok ? '' : (r.data?.error?.message || r.data?.message || `status ${r.status}`));
    } catch (e) {
      record(name, false, e.message);
    }
  }
}

async function allGetEndpoints(token) {
  const list = [
    '/api/todos', '/api/calendar/events', '/api/contacts', '/api/chat/conversations', '/api/emails',
    '/api/kanban/boards', '/api/files/folders', '/api/ecommerce/products', '/api/crm/leads',
    '/api/projects/projects', '/api/lms/courses', '/api/helpdesk/tickets', '/api/hr/employees',
    '/api/events/events', '/api/social/posts', '/api/users/profile'
  ];
  for (const p of list) {
    const name = `GET ${p}`;
    try {
      const r = await request('GET', p, null, token);
      record(name, r.ok, r.ok ? '' : (r.data?.error?.message || `status ${r.status}`));
    } catch (e) {
      record(name, false, e.message);
    }
  }
}

function generateHtml() {
  const total = results.passed + results.failed;
  const pct = total ? Math.round((results.passed / total) * 100) : 0;
  const rows = results.tests.map(t => `
    <tr class="${t.ok ? 'passed' : 'failed'}">
      <td>${t.ok ? '✅' : '❌'}</td>
      <td>${escapeHtml(t.name)}</td>
      <td>${t.ok ? 'PASS' : 'FAIL'}</td>
      <td>${escapeHtml(t.detail || '')}</td>
    </tr>`).join('');
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reporte de pruebas — Cloudignite</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; max-width: 900px; margin: 2rem auto; padding: 0 1rem; }
    h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    .meta { color: #6c757d; font-size: 0.9rem; margin-bottom: 1.5rem; }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
    th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #dee2e6; }
    th { background: #f8f9fa; }
    .passed { background: #d4edda; }
    .failed { background: #f8d7da; }
    .summary { display: flex; gap: 1rem; margin: 1rem 0; flex-wrap: wrap; }
    .badge { padding: 6px 12px; border-radius: 6px; font-weight: 600; }
    .badge-pass { background: #d4edda; color: #155724; }
    .badge-fail { background: #f8d7da; color: #721c24; }
    .badge-pct { background: #cce5ff; color: #004085; }
  </style>
</head>
<body>
  <h1>✅ Reporte de pruebas exhaustivas — Cloudignite</h1>
  <div class="meta">Generado: ${new Date().toISOString()} | Base: ${BASE}</div>
  <div class="summary">
    <span class="badge badge-pass">Pasaron: ${results.passed}</span>
    <span class="badge badge-fail">Fallaron: ${results.failed}</span>
    <span class="badge badge-pct">${pct}% éxito</span>
  </div>
  <h2>Detalle por prueba</h2>
  <table>
    <thead><tr><th></th><th>Prueba</th><th>Estado</th><th>Detalle</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
  return html;
}

function escapeHtml(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function run() {
  console.log('\n🔬 Pruebas exhaustivas — Cloudignite\n');
  console.log(`   Base: ${BASE}\n`);

  let token;
  try {
    const reg = await request('POST', '/api/auth/register', {
      companyName: 'Exhaustive Test',
      email: `exhaustive-${Date.now()}@test.com`,
      password: 'Password123!',
      firstName: 'Ex',
      lastName: 'Test'
    });
    if (!reg.ok || !reg.data?.data?.token) {
      console.error('❌ Register failed:', reg.status, reg.data?.error?.message || reg.data?.message);
      process.exit(1);
    }
    token = reg.data.data.token;
    record('Auth register', true);
  } catch (e) {
    console.error('❌ Auth failed:', e.message);
    process.exit(1);
  }

  const me = await request('GET', '/api/auth/me', null, token);
  record('GET /api/auth/me', me.ok, me.ok ? '' : (me.data?.error?.message || `status ${me.status}`));

  console.log('  CRUD Todo…');
  await crudTodo(token);
  console.log('  CRUD Contact…');
  await crudContact(token);
  console.log('  CRUD Calendar…');
  await crudCalendar(token);
  console.log('  CRUD CRM Lead…');
  await crudCrmLead(token);
  console.log('  Cost-control flow…');
  await costControlFlow(token);
  console.log('  All GET endpoints…');
  await allGetEndpoints(token);

  results.end = new Date().toISOString();

  const outDir = path.join(__dirname, '..');
  const jsonPath = path.join(outDir, 'exhaustive-results.json');
  const htmlPath = path.join(outDir, 'reporte-pruebas.html');
  const htmlContent = generateHtml();
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2), 'utf8');
  fs.writeFileSync(htmlPath, htmlContent, 'utf8');
  const filaHtml = path.join(outDir, '..', 'fila', 'reporte-pruebas.html');
  try { fs.writeFileSync(filaHtml, htmlContent, 'utf8'); } catch (_) {}

  console.log('\n' + '─'.repeat(50));
  console.log(`  Pasaron: ${results.passed}  Fallaron: ${results.failed}`);
  console.log('─'.repeat(50));
  console.log(`  JSON: ${jsonPath}`);
  console.log(`  HTML: ${htmlPath}`);
  console.log(`  Frontend: fila/reporte-pruebas.html → http://localhost:3000/reporte-pruebas.html\n`);

  process.exit(results.failed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
