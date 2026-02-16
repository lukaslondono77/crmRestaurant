#!/usr/bin/env node

/**
 * Repairs missing tenant_id columns on legacy tables.
 * Safe to run multiple times.
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database', 'restaurant_cost.db');
const db = new sqlite3.Database(dbPath);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function columnExists(table, column) {
  const rows = await all(`PRAGMA table_info(${table})`);
  return rows.some((row) => row.name === column);
}

async function ensureTenantColumn(table) {
  const exists = await columnExists(table, 'tenant_id');
  if (exists) {
    console.log(`✓ ${table}.tenant_id already exists`);
    return;
  }

  console.log(`+ Adding ${table}.tenant_id`);
  await run(`ALTER TABLE ${table} ADD COLUMN tenant_id INTEGER`);
  await run(`UPDATE ${table} SET tenant_id = 1 WHERE tenant_id IS NULL`);
}

async function ensureIndex(name, table, columns) {
  await run(`CREATE INDEX IF NOT EXISTS ${name} ON ${table}(${columns})`);
}

async function main() {
  try {
    const tablesToRepair = ['purchases', 'purchase_items', 'sales', 'sales_items', 'waste', 'inventory'];

    for (const table of tablesToRepair) {
      await ensureTenantColumn(table);
    }

    await ensureIndex('idx_purchases_tenant', 'purchases', 'tenant_id');
    await ensureIndex('idx_sales_tenant', 'sales', 'tenant_id');
    await ensureIndex('idx_waste_tenant', 'waste', 'tenant_id');
    await ensureIndex('idx_inventory_tenant', 'inventory', 'tenant_id');
    await ensureIndex('idx_purchase_items_tenant', 'purchase_items', 'tenant_id');
    await ensureIndex('idx_sales_items_tenant', 'sales_items', 'tenant_id');

    console.log('\n✅ Tenant schema repair completed');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Tenant schema repair failed:', err.message);
    process.exit(1);
  } finally {
    db.close();
  }
}

main();

