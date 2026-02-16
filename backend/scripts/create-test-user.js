/**
 * Script to create a test user for development
 * Usage: node scripts/create-test-user.js
 */

const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');

const dbPath = path.join(__dirname, '../database/restaurant_cost.db');
const db = new sqlite3.Database(dbPath);

async function createTestUser() {
  return new Promise((resolve, reject) => {
    // Default test credentials
    const testCompany = 'Test Restaurant';
    const testEmail = 'admin@test.com';
    const testPassword = 'admin123';
    const firstName = 'Admin';
    const lastName = 'User';

    // Hash password
    bcrypt.hash(testPassword, 10, (err, hash) => {
      if (err) {
        reject(err);
        return;
      }

      db.serialize(() => {
        // Check if tenant already exists
        db.get('SELECT id FROM tenants WHERE company_name = ?', [testCompany], (err, tenant) => {
          if (err) {
            reject(err);
            return;
          }

          const tenantId = tenant ? tenant.id : null;
          
          if (tenant) {
            console.log('✅ Tenant ya existe:', testCompany, '(ID:', tenantId + ')');
            // Extend trial so login works (trial_ends_at may have expired)
            db.run(
              `UPDATE tenants SET trial_ends_at = date('now', '+365 days'), subscription_status = 'trial' WHERE id = ?`,
              [tenantId],
              (err) => {
                if (err) console.warn('⚠️ Could not extend trial:', err.message);
                else console.log('✅ Trial extended to 365 days from today');
                // Check if user already exists
                db.get('SELECT id FROM users WHERE email = ?', [testEmail], (err, existingUser) => {
              if (err) {
                reject(err);
                return;
              }
              
              if (existingUser) {
                console.log('✅ Usuario ya existe:', testEmail);
                console.log('📧 Email:', testEmail);
                console.log('🔑 Password:', testPassword);
                console.log('\n💡 Puedes usar estas credenciales para iniciar sesión');
                db.close();
                resolve();
                return;
              }
              
              // Create user for existing tenant
              db.run(
                `INSERT INTO users (tenant_id, email, password_hash, first_name, last_name, role, is_active)
                 VALUES (?, ?, ?, ?, ?, 'admin', 1)`,
                [tenantId, testEmail, hash, firstName, lastName],
                function(err) {
                  if (err) {
                    reject(err);
                    return;
                  }
                  
                  console.log('✅ Usuario creado:', testEmail);
                  console.log('\n📋 CREDENCIALES DE PRUEBA:');
                  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                  console.log('📧 Email:    ', testEmail);
                  console.log('🔑 Password: ', testPassword);
                  console.log('🏢 Empresa:  ', testCompany);
                  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                  console.log('\n💡 Puedes usar estas credenciales para iniciar sesión');
                  console.log('   en http://localhost:3000/sign-in.html');
                  
                  db.close();
                  resolve();
                }
              );
            });
              });
            return;
          }

          // Create tenant
          db.run(
            `INSERT INTO tenants (company_name, subscription_plan, subscription_status, trial_ends_at)
             VALUES (?, 'basic', 'trial', date('now', '+14 days'))`,
            [testCompany],
            function(err) {
              if (err) {
                reject(err);
                return;
              }

              const tenantId = this.lastID;
              console.log('✅ Tenant creado:', testCompany, '(ID:', tenantId + ')');

              // Create user
              db.run(
                `INSERT INTO users (tenant_id, email, password_hash, first_name, last_name, role, is_active)
                 VALUES (?, ?, ?, ?, ?, 'admin', 1)`,
                [tenantId, testEmail, hash, firstName, lastName],
                function(err) {
                  if (err) {
                    reject(err);
                    return;
                  }

                  console.log('✅ Usuario creado:', testEmail);
                  console.log('\n📋 CREDENCIALES DE PRUEBA:');
                  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                  console.log('📧 Email:    ', testEmail);
                  console.log('🔑 Password: ', testPassword);
                  console.log('🏢 Empresa:  ', testCompany);
                  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                  console.log('\n💡 Puedes usar estas credenciales para iniciar sesión');
                  console.log('   en http://localhost:3000/sign-in.html');
                  
                  db.close();
                  resolve();
                }
              );
            }
          );
        });
      });
    });
  });
}

// Run
createTestUser()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
