#!/usr/bin/env node

/**
 * Script to run all database migrations
 */

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

const dbPath = path.join(__dirname, '..', 'database', 'restaurant_cost.db');
const migrationsDir = path.join(__dirname, '..', 'database', 'migrations');

// Ensure database directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Get all migration files
const migrations = fs.readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql'))
  .sort()
  .map(f => ({
    filename: f,
    path: path.join(migrationsDir, f)
  }));

log(`\n🔄 Ejecutando ${migrations.length} migraciones...\n`, 'blue');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    log(`❌ Error al conectar a la base de datos: ${err.message}`, 'red');
    process.exit(1);
  }
  log('✅ Conectado a la base de datos\n', 'green');
});

let completed = 0;
let errors = 0;

migrations.forEach((migration, index) => {
  const migrationSQL = fs.readFileSync(migration.path, 'utf8');
  
  log(`[${index + 1}/${migrations.length}] Ejecutando ${migration.filename}...`, 'blue');
  
  db.exec(migrationSQL, (err) => {
    if (err) {
      log(`  ❌ Error: ${err.message}`, 'red');
      errors++;
    } else {
      log(`  ✅ Completado`, 'green');
      completed++;
    }
    
    // Check if all migrations are done
    if (completed + errors === migrations.length) {
      log(`\n📊 Resumen:`, 'blue');
      log(`   ✅ Completadas: ${completed}`, 'green');
      if (errors > 0) {
        log(`   ❌ Errores: ${errors}`, 'red');
      }
      
      db.close((err) => {
        if (err) {
          log(`\n⚠️  Error al cerrar la base de datos: ${err.message}`, 'yellow');
        } else {
          log('\n✅ Migraciones completadas!\n', 'green');
        }
        process.exit(errors > 0 ? 1 : 0);
      });
    }
  });
});
