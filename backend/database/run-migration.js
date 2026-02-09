const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'restaurant_cost.db');
const migrationPath = path.join(__dirname, 'migrations/001_add_multi_tenant.sql');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err);
    process.exit(1);
  }
  console.log('✅ Connected to SQLite database');
});

// Función para verificar si una columna existe
function columnExists(tableName, columnName, callback) {
  db.all(`PRAGMA table_info(${tableName})`, (err, columns) => {
    if (err) {
      callback(err, false);
      return;
    }
    const exists = columns.some(col => col.name === columnName);
    callback(null, exists);
  });
}

// Función para agregar columna si no existe
function addColumnIfNotExists(tableName, columnName, columnDefinition, callback) {
  columnExists(tableName, columnName, (err, exists) => {
    if (err) {
      callback(err);
      return;
    }
    if (!exists) {
      db.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`, (err) => {
        if (err) {
          console.error(`❌ Error adding column ${columnName} to ${tableName}:`, err.message);
          callback(err);
        } else {
          console.log(`✅ Added column ${columnName} to ${tableName}`);
          callback(null);
        }
      });
    } else {
      console.log(`ℹ️  Column ${columnName} already exists in ${tableName}`);
      callback(null);
    }
  });
}

// Leer migración
const migration = fs.readFileSync(migrationPath, 'utf8');

// Ejecutar migración paso a paso
async function runMigration() {
  return new Promise((resolve, reject) => {
    // Primero crear las nuevas tablas (tenants y users)
    db.exec(`
      CREATE TABLE IF NOT EXISTS tenants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_name TEXT NOT NULL,
        subdomain TEXT UNIQUE,
        square_access_token TEXT,
        square_location_id TEXT,
        subscription_plan TEXT DEFAULT 'basic',
        subscription_status TEXT DEFAULT 'trial',
        trial_ends_at DATE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER NOT NULL,
        email TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        first_name TEXT,
        last_name TEXT,
        role TEXT DEFAULT 'manager',
        is_active BOOLEAN DEFAULT 1,
        last_login DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
        UNIQUE(tenant_id, email)
      );
    `, (err) => {
      if (err) {
        console.error('❌ Error creating new tables:', err);
        reject(err);
        return;
      }
      console.log('✅ Created tenants and users tables');

      // Agregar tenant_id a tablas existentes
      const tables = [
        { name: 'purchases', def: 'INTEGER' },
        { name: 'purchase_items', def: 'INTEGER' },
        { name: 'sales', def: 'INTEGER' },
        { name: 'sales_items', def: 'INTEGER' },
        { name: 'waste', def: 'INTEGER' },
        { name: 'inventory', def: 'INTEGER' }
      ];

      let completed = 0;
      const total = tables.length;

      tables.forEach(table => {
        addColumnIfNotExists(table.name, 'tenant_id', table.def, (err) => {
          if (err) {
            reject(err);
            return;
          }
          completed++;
          if (completed === total) {
            // Crear índices
            db.exec(`
              CREATE INDEX IF NOT EXISTS idx_purchases_tenant ON purchases(tenant_id);
              CREATE INDEX IF NOT EXISTS idx_sales_tenant ON sales(tenant_id);
              CREATE INDEX IF NOT EXISTS idx_waste_tenant ON waste(tenant_id);
              CREATE INDEX IF NOT EXISTS idx_inventory_tenant ON inventory(tenant_id);
              CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
              CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
            `, (err) => {
              if (err) {
                console.error('❌ Error creating indexes:', err);
                reject(err);
              } else {
                console.log('✅ Created indexes');
                console.log('✅ Migration completed successfully!');
                db.close();
                resolve();
              }
            });
          }
        });
      });
    });
  });
}

// Ejecutar migración
runMigration().catch(err => {
  console.error('❌ Migration failed:', err);
  db.close();
  process.exit(1);
});
