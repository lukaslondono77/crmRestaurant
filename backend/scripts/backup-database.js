/**
 * Automated Database Backup Script
 * Creates timestamped backups with retention policy
 */

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const dbPath = path.join(__dirname, '../database/restaurant_cost.db');
const backupDir = path.join(__dirname, '../database/backups');
const retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS || '30');

class DatabaseBackup {
  constructor() {
    // Ensure backup directory exists
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
  }

  /**
   * Create backup
   */
  async createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `restaurant_cost_${timestamp}.db`);
    
    console.log(`📦 Creating backup: ${backupPath}`);
    
    try {
      // Use SQLite backup API for online backup
      return new Promise((resolve, reject) => {
        const sourceDb = new sqlite3.Database(dbPath, (err) => {
          if (err) {
            reject(err);
            return;
          }

          const backupDb = new sqlite3.Database(backupPath, (err) => {
            if (err) {
              sourceDb.close();
              reject(err);
              return;
            }

            sourceDb.backup(backupDb)
              .then(() => {
                console.log('✅ Backup completed');
                sourceDb.close();
                backupDb.close();
                
                // Compress backup
                this.compressBackup(backupPath)
                  .then(() => resolve(backupPath))
                  .catch(reject);
              })
              .catch((err) => {
                sourceDb.close();
                backupDb.close();
                reject(err);
              });
          });
        });
      });
    } catch (error) {
      console.error('❌ Backup failed:', error.message);
      throw error;
    }
  }

  /**
   * Compress backup using gzip
   */
  async compressBackup(backupPath) {
    try {
      const compressedPath = backupPath + '.gz';
      execSync(`gzip -c "${backupPath}" > "${compressedPath}"`);
      fs.unlinkSync(backupPath); // Remove uncompressed file
      console.log(`✅ Backup compressed: ${compressedPath}`);
      return compressedPath;
    } catch (error) {
      console.warn('⚠️  Compression failed (gzip not available), keeping uncompressed backup');
      return backupPath;
    }
  }

  /**
   * Verify backup integrity
   */
  async verifyBackup(backupPath) {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(backupPath, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
          reject(err);
          return;
        }

        db.get('PRAGMA integrity_check', (err, row) => {
          db.close();
          
          if (err) {
            reject(err);
            return;
          }

          if (row.integrity_check === 'ok') {
            resolve(true);
          } else {
            reject(new Error(`Integrity check failed: ${row.integrity_check}`));
          }
        });
      });
    });
  }

  /**
   * Clean old backups based on retention policy
   */
  cleanOldBackups() {
    console.log(`🧹 Cleaning backups older than ${retentionDays} days...`);
    
    const files = fs.readdirSync(backupDir);
    const now = Date.now();
    const retentionMs = retentionDays * 24 * 60 * 60 * 1000;
    
    let deleted = 0;
    let totalSize = 0;
    
    files.forEach(file => {
      if (!file.startsWith('restaurant_cost_') || !file.endsWith('.db.gz')) {
        return;
      }

      const filePath = path.join(backupDir, file);
      const stats = fs.statSync(filePath);
      const age = now - stats.mtimeMs;
      
      if (age > retentionMs) {
        const size = stats.size;
        fs.unlinkSync(filePath);
        deleted++;
        totalSize += size;
        console.log(`   Deleted: ${file} (${(size / 1024 / 1024).toFixed(2)} MB)`);
      }
    });
    
    if (deleted > 0) {
      console.log(`✅ Cleaned ${deleted} old backups (freed ${(totalSize / 1024 / 1024).toFixed(2)} MB)`);
    } else {
      console.log('✅ No old backups to clean');
    }
    
    return { deleted, freedMB: totalSize / 1024 / 1024 };
  }

  /**
   * List all backups
   */
  listBackups() {
    const files = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('restaurant_cost_') && f.endsWith('.db.gz'))
      .map(f => {
        const filePath = path.join(backupDir, f);
        const stats = fs.statSync(filePath);
        return {
          filename: f,
          size: stats.size,
          sizeMB: (stats.size / 1024 / 1024).toFixed(2),
          created: stats.mtime,
          age: Math.floor((Date.now() - stats.mtimeMs) / (24 * 60 * 60 * 1000)) + ' days'
        };
      })
      .sort((a, b) => b.created - a.created);
    
    return files;
  }

  /**
   * Get backup statistics
   */
  getStats() {
    const backups = this.listBackups();
    const totalSize = backups.reduce((sum, b) => sum + b.size, 0);
    
    return {
      count: backups.length,
      totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
      oldest: backups.length > 0 ? backups[backups.length - 1].created : null,
      newest: backups.length > 0 ? backups[0].created : null,
      retentionDays
    };
  }
}

// CLI usage
if (require.main === module) {
  const backup = new DatabaseBackup();
  const command = process.argv[2];

  (async () => {
    try {
      switch (command) {
        case 'create':
          const backupPath = await backup.createBackup();
          await backup.verifyBackup(backupPath.replace('.gz', ''));
          console.log(`✅ Backup created and verified: ${backupPath}`);
          break;

        case 'list':
          const backups = backup.listBackups();
          console.log('\n📦 Available Backups:\n');
          backups.forEach((b, i) => {
            console.log(`${i + 1}. ${b.filename}`);
            console.log(`   Size: ${b.sizeMB} MB | Age: ${b.age} | Created: ${b.created}`);
          });
          break;

        case 'stats':
          const stats = backup.getStats();
          console.log('\n📊 Backup Statistics:\n');
          console.log(`   Total Backups: ${stats.count}`);
          console.log(`   Total Size: ${stats.totalSizeMB} MB`);
          console.log(`   Oldest: ${stats.oldest || 'N/A'}`);
          console.log(`   Newest: ${stats.newest || 'N/A'}`);
          console.log(`   Retention: ${stats.retentionDays} days\n`);
          break;

        case 'clean':
          backup.cleanOldBackups();
          break;

        default:
          console.log('Usage: node backup-database.js [create|list|stats|clean]');
          process.exit(1);
      }
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  })();
}

module.exports = DatabaseBackup;
