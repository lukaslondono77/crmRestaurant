#!/usr/bin/env node

/**
 * Script to verify backend setup
 * Checks that all routes, services, and migrations are in place
 */

const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkFile(filePath, description) {
  const fullPath = path.join(__dirname, '..', filePath);
  if (fs.existsSync(fullPath)) {
    log(`✅ ${description}`, 'green');
    return true;
  } else {
    log(`❌ ${description} - NOT FOUND`, 'red');
    return false;
  }
}

function checkDirectory(dirPath, description) {
  const fullPath = path.join(__dirname, '..', dirPath);
  if (fs.existsSync(fullPath)) {
    const files = fs.readdirSync(fullPath).filter(f => f.endsWith('.js') || f.endsWith('.sql'));
    log(`✅ ${description} (${files.length} files)`, 'green');
    return { exists: true, count: files.length };
  } else {
    log(`❌ ${description} - NOT FOUND`, 'red');
    return { exists: false, count: 0 };
  }
}

log('\n🔍 Verificando configuración del backend...\n', 'cyan');

// Check main files
log('📄 Archivos principales:', 'blue');
checkFile('src/server.js', 'Server principal');
checkFile('package.json', 'Package.json');
checkFile('.env', 'Archivo .env (opcional)');

// Check directories
log('\n📁 Directorios:', 'blue');
const routes = checkDirectory('src/routes', 'Rutas API');
const services = checkDirectory('src/services', 'Servicios');
const migrations = checkDirectory('database/migrations', 'Migraciones de base de datos');
checkDirectory('src/middleware', 'Middleware');
checkDirectory('src/config', 'Configuración');
checkDirectory('src/utils', 'Utilidades');

// Check specific important files
log('\n🔧 Archivos importantes:', 'blue');
checkFile('src/middleware/auth.js', 'Middleware de autenticación');
checkFile('src/config/database.js', 'Configuración de base de datos');
checkFile('src/utils/errorHandler.js', 'Manejo de errores');
checkFile('src/utils/pagination.js', 'Utilidades de paginación');

// Check database
log('\n💾 Base de datos:', 'blue');
const dbPath = path.join(__dirname, '..', 'database', 'restaurant_cost.db');
if (fs.existsSync(dbPath)) {
  const stats = fs.statSync(dbPath);
  log(`✅ Base de datos existe (${(stats.size / 1024).toFixed(2)} KB)`, 'green');
} else {
  log('⚠️  Base de datos no existe (se creará al iniciar el servidor)', 'yellow');
}

// Summary
log('\n📊 Resumen:', 'cyan');
log(`   • Rutas: ${routes.count} archivos`, routes.exists ? 'green' : 'red');
log(`   • Servicios: ${services.count} archivos`, services.exists ? 'green' : 'red');
log(`   • Migraciones: ${migrations.count} archivos`, migrations.exists ? 'green' : 'red');

if (routes.exists && services.exists && migrations.exists) {
  log('\n✅ Configuración completa! El backend está listo para usar.\n', 'green');
  process.exit(0);
} else {
  log('\n⚠️  Algunos archivos faltan. Revisa los errores arriba.\n', 'yellow');
  process.exit(1);
}
