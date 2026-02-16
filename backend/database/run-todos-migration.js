/**
 * Run todos table migration
 */

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'restaurant_cost.db');
const migrationPath = path.join(__dirname, 'migrations', '002_add_todos.sql');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err);
    process.exit(1);
  }
  console.log('✅ Connected to database');
});

const migrationSql = fs.readFileSync(migrationPath, 'utf8');

db.exec(migrationSql, (err) => {
  if (err) {
    console.error('❌ Error running migration:', err);
    db.close();
    process.exit(1);
  }
  console.log('✅ Todos table migration completed successfully!');
  db.close();
});
