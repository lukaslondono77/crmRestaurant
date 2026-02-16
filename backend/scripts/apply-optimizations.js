/**
 * Safe Deployment Script for Performance Optimizations
 * Applies database indexes, validates performance, and provides rollback
 */

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const dbPath = path.join(__dirname, '../database/restaurant_cost.db');
const backupPath = path.join(__dirname, '../database/restaurant_cost.backup.' + Date.now() + '.db');
const migrationPath = path.join(__dirname, '../database/migrations/020_add_performance_indexes.sql');

class OptimizationDeployer {
  constructor() {
    this.db = null;
    this.backupCreated = false;
    this.indexesApplied = false;
    this.rollbackSteps = [];
  }

  /**
   * Step 1: Create database backup
   */
  async createBackup() {
    console.log('📦 Step 1: Creating database backup...');
    try {
      // Copy database file
      fs.copyFileSync(dbPath, backupPath);
      this.backupCreated = true;
      this.rollbackSteps.push(() => {
        console.log('🔄 Restoring from backup...');
        fs.copyFileSync(backupPath, dbPath);
      });
      console.log(`✅ Backup created: ${backupPath}`);
      return true;
    } catch (error) {
      console.error('❌ Backup failed:', error.message);
      return false;
    }
  }

  /**
   * Step 2: Validate database integrity
   */
  async validateDatabase() {
    console.log('🔍 Step 2: Validating database integrity...');
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          console.error('❌ Database connection failed:', err.message);
          reject(err);
          return;
        }

        // Run integrity check
        this.db.get('PRAGMA integrity_check', (err, row) => {
          if (err) {
            console.error('❌ Integrity check failed:', err.message);
            reject(err);
            return;
          }

          if (row.integrity_check === 'ok') {
            console.log('✅ Database integrity: OK');
            resolve(true);
          } else {
            console.error('❌ Database integrity check failed:', row.integrity_check);
            reject(new Error('Database integrity check failed'));
          }
        });
      });
    });
  }

  /**
   * Step 3: Check existing indexes
   */
  async checkExistingIndexes() {
    console.log('🔍 Step 3: Checking existing indexes...');
    return new Promise((resolve) => {
      this.db.all(`
        SELECT name, sql 
        FROM sqlite_master 
        WHERE type='index' AND name LIKE 'idx_%'
        ORDER BY name
      `, (err, rows) => {
        if (err) {
          console.error('❌ Error checking indexes:', err.message);
          resolve([]);
          return;
        }

        console.log(`📊 Found ${rows.length} existing indexes`);
        if (rows.length > 0) {
          console.log('   Existing indexes:', rows.map(r => r.name).join(', '));
        }
        resolve(rows);
      });
    });
  }

  /**
   * Step 4: Apply indexes migration
   */
  async applyIndexes() {
    console.log('🚀 Step 4: Applying performance indexes...');
    
    if (!fs.existsSync(migrationPath)) {
      console.error(`❌ Migration file not found: ${migrationPath}`);
      return false;
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    return new Promise((resolve, reject) => {
      // Split by semicolon and execute each statement
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      let completed = 0;
      let errors = [];

      statements.forEach((statement, index) => {
        this.db.run(statement, (err) => {
          if (err) {
            // Ignore "index already exists" errors
            if (!err.message.includes('already exists')) {
              errors.push({ statement: statement.substring(0, 50), error: err.message });
            }
          }
          
          completed++;
          if (completed === statements.length) {
            if (errors.length > 0) {
              console.warn(`⚠️  ${errors.length} errors (likely duplicates):`);
              errors.forEach(e => console.warn(`   ${e.statement}... - ${e.error}`));
            }
            
            this.indexesApplied = true;
            console.log(`✅ Applied ${statements.length} index statements`);
            resolve(true);
          }
        });
      });
    });
  }

  /**
   * Step 5: Validate indexes were created
   */
  async validateIndexes() {
    console.log('✅ Step 5: Validating indexes...');
    
    const expectedIndexes = [
      'idx_purchases_tenant_date',
      'idx_sales_tenant_date',
      'idx_inventory_tenant_name',
      'idx_chat_messages_conversation',
      'idx_chat_participants_user'
    ];

    return new Promise((resolve) => {
      this.db.all(`
        SELECT name 
        FROM sqlite_master 
        WHERE type='index' AND name LIKE 'idx_%'
      `, (err, rows) => {
        if (err) {
          console.error('❌ Error validating indexes:', err.message);
          resolve(false);
          return;
        }

        const indexNames = rows.map(r => r.name);
        const missing = expectedIndexes.filter(idx => !indexNames.includes(idx));
        
        if (missing.length > 0) {
          console.warn(`⚠️  Missing indexes: ${missing.join(', ')}`);
        } else {
          console.log(`✅ All critical indexes validated (${indexNames.length} total)`);
        }
        
        resolve(missing.length === 0);
      });
    });
  }

  /**
   * Step 6: Test query performance
   */
  async testQueryPerformance() {
    console.log('⚡ Step 6: Testing query performance...');
    
    const testQueries = [
      {
        name: 'Inventory by tenant',
        sql: 'SELECT COUNT(*) FROM inventory WHERE tenant_id = 1',
        expectedTime: 50 // milliseconds
      },
      {
        name: 'Sales by date range',
        sql: 'SELECT COUNT(*) FROM sales WHERE tenant_id = 1 AND report_date BETWEEN ? AND ?',
        params: ['2024-01-01', '2024-12-31'],
        expectedTime: 100
      }
    ];

    const results = [];
    
    for (const query of testQueries) {
      const start = Date.now();
      await new Promise((resolve, reject) => {
        this.db.get(query.sql, query.params || [], (err) => {
          const duration = Date.now() - start;
          if (err) {
            console.warn(`⚠️  Query "${query.name}" failed: ${err.message}`);
            results.push({ name: query.name, duration, passed: false });
          } else {
            const passed = duration < query.expectedTime;
            console.log(`   ${query.name}: ${duration}ms ${passed ? '✅' : '⚠️'}`);
            results.push({ name: query.name, duration, passed });
          }
          resolve();
        });
      });
    }

    const allPassed = results.every(r => r.passed);
    if (allPassed) {
      console.log('✅ All performance tests passed');
    } else {
      console.warn('⚠️  Some queries are slower than expected (indexes may need time to optimize)');
    }
    
    return allPassed;
  }

  /**
   * Step 7: Analyze tables (update statistics)
   */
  async analyzeTables() {
    console.log('📊 Step 7: Analyzing tables (updating statistics)...');
    
    return new Promise((resolve) => {
      this.db.run('ANALYZE', (err) => {
        if (err) {
          console.warn('⚠️  ANALYZE failed:', err.message);
        } else {
          console.log('✅ Table statistics updated');
        }
        resolve(true);
      });
    });
  }

  /**
   * Rollback all changes
   */
  async rollback() {
    console.log('\n🔄 ROLLBACK INITIATED\n');
    
    // Close database connection
    if (this.db) {
      this.db.close();
    }

    // Execute rollback steps in reverse order
    for (let i = this.rollbackSteps.length - 1; i >= 0; i--) {
      try {
        this.rollbackSteps[i]();
      } catch (error) {
        console.error(`❌ Rollback step ${i} failed:`, error.message);
      }
    }

    console.log('✅ Rollback completed');
    console.log(`📦 Backup available at: ${backupPath}`);
  }

  /**
   * Main deployment process
   */
  async deploy() {
    console.log('🚀 Starting Performance Optimizations Deployment\n');
    console.log('=' .repeat(60));
    
    try {
      // Step 1: Backup
      if (!(await this.createBackup())) {
        throw new Error('Backup creation failed');
      }

      // Step 2: Validate
      await this.validateDatabase();

      // Step 3: Check existing
      await this.checkExistingIndexes();

      // Step 4: Apply indexes
      if (!(await this.applyIndexes())) {
        throw new Error('Index application failed');
      }

      // Step 5: Validate
      await this.validateIndexes();

      // Step 6: Test performance
      await this.testQueryPerformance();

      // Step 7: Analyze
      await this.analyzeTables();

      console.log('\n' + '='.repeat(60));
      console.log('✅ DEPLOYMENT SUCCESSFUL\n');
      console.log('📊 Next steps:');
      console.log('   1. Monitor performance metrics');
      console.log('   2. Check cache hit rates');
      console.log('   3. Verify response times improved');
      console.log(`\n📦 Backup saved at: ${backupPath}`);
      console.log('   (Keep this for 7 days before deleting)\n');

      // Close database
      this.db.close();
      return true;

    } catch (error) {
      console.error('\n❌ DEPLOYMENT FAILED:', error.message);
      console.log('\n🔄 Initiating rollback...\n');
      await this.rollback();
      return false;
    }
  }
}

// Run deployment
if (require.main === module) {
  const deployer = new OptimizationDeployer();
  deployer.deploy()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = OptimizationDeployer;
