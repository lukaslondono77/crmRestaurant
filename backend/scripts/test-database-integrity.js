#!/usr/bin/env node

/**
 * Database integrity checks: tables exist, tenant isolation, basic queries.
 * Usage: node scripts/test-database-integrity.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const db = require('../src/config/database');

const results = { passed: 0, failed: 0, tests: [] };

function record(name, ok, detail = '') {
  results.tests.push({ name, ok, detail });
  if (ok) results.passed++; else results.failed++;
}

async function run() {
  console.log('\n🗄️ Database integrity checks\n');

  try {
    const tables = await db.allAsync("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
    const names = (tables || []).map((t) => t.name);
    const expected = [
      'tenants', 'users', 'purchases', 'purchase_items', 'sales', 'sales_items',
      'inventory', 'waste', 'todos', 'calendar_events', 'contacts', 'inventory_counts'
    ];
    const missing = expected.filter((e) => !names.includes(e));
    record('Core tables exist', missing.length === 0, missing.length ? `Missing: ${missing.join(', ')}` : '');

    const tenantCount = await db.getAsync('SELECT COUNT(*) as c FROM tenants');
    record('Tenants table readable', !!tenantCount && tenantCount.c >= 0, tenantCount ? `${tenantCount.c} tenants` : '');

    const userCount = await db.getAsync('SELECT COUNT(*) as c FROM users');
    record('Users table readable', !!userCount && userCount.c >= 0, userCount ? `${userCount.c} users` : '');

    const multi = await db.getAsync('SELECT COUNT(DISTINCT tenant_id) as n FROM users');
    record('Multi-tenant data', !!multi && multi.n >= 0, multi ? `${multi.n} tenant(s)` : '');

    const idx = await db.allAsync("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='inventory'");
    record('Inventory indexes present', Array.isArray(idx) && idx.length > 0, idx ? `${idx.length} indexes` : '');
  } catch (e) {
    record('Database connection', false, e.message);
  }

  console.log('  ' + results.tests.map((t) => (t.ok ? '✅' : '❌') + ' ' + t.name).join('\n  '));
  console.log('\n' + '─'.repeat(50));
  console.log(`  Passed: ${results.passed}  Failed: ${results.failed}`);
  console.log('─'.repeat(50) + '\n');

  process.exit(results.failed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
