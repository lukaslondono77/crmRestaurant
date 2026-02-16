/**
 * Feature Flags System
 * Allows dynamic control of features without code deployment
 */

const fs = require('fs');
const path = require('path');

class FeatureFlags {
  constructor() {
    this.flags = {
      // Performance optimizations
      ENABLE_PERFORMANCE_CACHE: process.env.ENABLE_CACHE !== 'false',
      ENABLE_QUERY_OPTIMIZATIONS: process.env.ENABLE_QUERY_OPTIMIZATIONS !== 'false',
      
      // Logging
      LOG_LEVEL: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
      ENABLE_QUERY_LOGGING: process.env.ENABLE_QUERY_LOGGING === 'true',
      
      // Maintenance
      MAINTENANCE_MODE: process.env.MAINTENANCE_MODE === 'true',
      MAINTENANCE_MESSAGE: process.env.MAINTENANCE_MESSAGE || 'System under maintenance',
      
      // Feature toggles
      ENABLE_SQUARE_SYNC: process.env.ENABLE_SQUARE_SYNC !== 'false',
      ENABLE_OCR_PROCESSING: process.env.ENABLE_OCR_PROCESSING !== 'false',
      ENABLE_REAL_TIME_UPDATES: process.env.ENABLE_REAL_TIME_UPDATES === 'true',
      ENABLE_OWNER_VIEW: process.env.ENABLE_OWNER_VIEW !== 'false',
      
      // Rate limiting
      ENABLE_RATE_LIMITING: process.env.ENABLE_RATE_LIMITING !== 'false',
      RATE_LIMIT_STRICT: process.env.RATE_LIMIT_STRICT === 'true',
      
      // Circuit breakers
      ENABLE_CIRCUIT_BREAKERS: process.env.ENABLE_CIRCUIT_BREAKERS !== 'false',
      
      // Cache settings
      CACHE_TTL_DASHBOARD: parseInt(process.env.CACHE_TTL_DASHBOARD || '300000'), // 5 min
      CACHE_TTL_ANALYTICS: parseInt(process.env.CACHE_TTL_ANALYTICS || '600000'), // 10 min
      CACHE_MAX_SIZE: parseInt(process.env.CACHE_MAX_SIZE || '100'),
    };
    
    this.configFile = path.join(__dirname, '../../.feature-flags.json');
    this.loadFromFile();
  }

  /**
   * Load flags from file (if exists)
   */
  loadFromFile() {
    try {
      if (fs.existsSync(this.configFile)) {
        const fileFlags = JSON.parse(fs.readFileSync(this.configFile, 'utf8'));
        this.flags = { ...this.flags, ...fileFlags };
        console.log('📋 Feature flags loaded from file');
      }
    } catch (error) {
      console.warn('⚠️  Could not load feature flags file:', error.message);
    }
  }

  /**
   * Save flags to file
   */
  saveToFile() {
    try {
      fs.writeFileSync(this.configFile, JSON.stringify(this.flags, null, 2));
      return true;
    } catch (error) {
      console.error('❌ Could not save feature flags:', error.message);
      return false;
    }
  }

  /**
   * Get flag value
   */
  get(flagName, defaultValue = false) {
    return this.flags[flagName] !== undefined ? this.flags[flagName] : defaultValue;
  }

  /**
   * Set flag value
   */
  set(flagName, value) {
    const oldValue = this.flags[flagName];
    this.flags[flagName] = value;
    this.saveToFile();
    
    console.log(`🔧 Feature flag updated: ${flagName} = ${value} (was: ${oldValue})`);
    return true;
  }

  /**
   * Check if flag is enabled
   */
  isEnabled(flagName) {
    const value = this.get(flagName);
    return value === true || value === 'true' || value === 1;
  }

  /**
   * Get all flags
   */
  getAll() {
    return { ...this.flags };
  }

  /**
   * Update multiple flags
   */
  update(updates) {
    Object.keys(updates).forEach(key => {
      this.set(key, updates[key]);
    });
    return this.getAll();
  }

  /**
   * Reset to defaults
   */
  reset() {
    this.flags = {
      ENABLE_PERFORMANCE_CACHE: true,
      ENABLE_QUERY_OPTIMIZATIONS: true,
      LOG_LEVEL: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      MAINTENANCE_MODE: false,
      ENABLE_SQUARE_SYNC: true,
      ENABLE_OCR_PROCESSING: true,
      ENABLE_RATE_LIMITING: true,
      ENABLE_CIRCUIT_BREAKERS: true,
    };
    this.saveToFile();
    return this.getAll();
  }
}

// Singleton instance
const featureFlags = new FeatureFlags();

module.exports = featureFlags;
