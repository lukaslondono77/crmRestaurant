/**
 * Simple In-Memory Cache Service
 * For caching expensive operations like dashboard metrics
 */

class CacheService {
  constructor() {
    this.cache = new Map();
    this.defaultTTL = 5 * 60 * 1000; // 5 minutes
    this.maxSize = parseInt(process.env.CACHE_MAX_SIZE || '100', 10);
  }

  /**
   * Get value from cache
   */
  get(key) {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }
    
    // Check if expired
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }

  /**
   * Set value in cache
   */
  set(key, value, ttl = this.defaultTTL) {
    // Evict oldest if at max size
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttl,
      createdAt: Date.now()
    });
  }

  /**
   * Delete from cache
   */
  delete(key) {
    this.cache.delete(key);
  }

  /**
   * Clear all cache
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Invalidate cache by pattern (e.g., all keys for a tenant)
   */
  invalidatePattern(pattern) {
    const keysToDelete = [];
    this.cache.forEach((item, key) => {
      if (key.includes(pattern)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => this.cache.delete(key));
    return keysToDelete.length;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const now = Date.now();
    let expired = 0;
    let active = 0;
    
    this.cache.forEach(item => {
      if (now > item.expiresAt) {
        expired++;
      } else {
        active++;
      }
    });
    
    return {
      total: this.cache.size,
      active,
      expired,
      maxSize: this.maxSize
    };
  }

  /**
   * Clean expired entries
   */
  cleanExpired() {
    const now = Date.now();
    const keysToDelete = [];
    
    this.cache.forEach((item, key) => {
      if (now > item.expiresAt) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => this.cache.delete(key));
    return keysToDelete.length;
  }
}

// Singleton instance
const cacheService = new CacheService();

// Clean expired entries every 5 minutes
setInterval(() => {
  cacheService.cleanExpired();
}, 5 * 60 * 1000);

module.exports = cacheService;
