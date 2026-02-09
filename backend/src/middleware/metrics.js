/**
 * Metrics Collection Middleware
 * Tracks performance metrics for monitoring and alerting
 */

const featureFlags = require('../utils/featureFlags');

class MetricsCollector {
  constructor() {
    this.metrics = {
      requests: {
        total: 0,
        byMethod: {},
        byEndpoint: {},
        byStatus: {}
      },
      responseTimes: {
        byEndpoint: {},
        percentiles: {}
      },
      errors: {
        total: 0,
        byType: {},
        byEndpoint: {}
      },
      cache: {
        hits: 0,
        misses: 0
      },
      database: {
        queries: 0,
        slowQueries: 0
      }
    };
    
    this.startTime = Date.now();
    this.sampleSize = 1000; // Keep last 1000 response times per endpoint
  }

  /**
   * Record request
   */
  recordRequest(method, endpoint, statusCode, duration) {
    this.metrics.requests.total++;
    
    // By method
    this.metrics.requests.byMethod[method] = (this.metrics.requests.byMethod[method] || 0) + 1;
    
    // By endpoint (normalize)
    const normalizedEndpoint = this.normalizeEndpoint(endpoint);
    this.metrics.requests.byEndpoint[normalizedEndpoint] = 
      (this.metrics.requests.byEndpoint[normalizedEndpoint] || 0) + 1;
    
    // By status
    const statusGroup = Math.floor(statusCode / 100) * 100;
    this.metrics.requests.byStatus[statusGroup] = 
      (this.metrics.requests.byStatus[statusGroup] || 0) + 1;
    
    // Response times
    if (!this.metrics.responseTimes.byEndpoint[normalizedEndpoint]) {
      this.metrics.responseTimes.byEndpoint[normalizedEndpoint] = [];
    }
    
    const times = this.metrics.responseTimes.byEndpoint[normalizedEndpoint];
    times.push(duration);
    
    // Keep only last N samples
    if (times.length > this.sampleSize) {
      times.shift();
    }
    
    // Track slow queries (> 1 second)
    if (duration > 1000) {
      this.metrics.database.slowQueries++;
    }
    
    // Track errors
    if (statusCode >= 400) {
      this.metrics.errors.total++;
      this.metrics.errors.byEndpoint[normalizedEndpoint] = 
        (this.metrics.errors.byEndpoint[normalizedEndpoint] || 0) + 1;
    }
  }

  /**
   * Record cache hit
   */
  recordCacheHit() {
    this.metrics.cache.hits++;
  }

  /**
   * Record cache miss
   */
  recordCacheMiss() {
    this.metrics.cache.misses++;
  }

  /**
   * Record database query
   */
  recordDatabaseQuery() {
    this.metrics.database.queries++;
  }

  /**
   * Normalize endpoint (remove IDs, etc.)
   */
  normalizeEndpoint(endpoint) {
    return endpoint
      .replace(/\/\d+/g, '/:id')
      .replace(/\/[a-f0-9-]{36}/gi, '/:id')
      .split('?')[0]; // Remove query params
  }

  /**
   * Calculate percentiles
   */
  calculatePercentiles(times, percentiles = [50, 75, 90, 95, 99]) {
    if (times.length === 0) return {};
    
    const sorted = [...times].sort((a, b) => a - b);
    const result = {};
    
    percentiles.forEach(p => {
      const index = Math.ceil((p / 100) * sorted.length) - 1;
      result[`p${p}`] = sorted[Math.max(0, index)];
    });
    
    return result;
  }

  /**
   * Get all metrics
   */
  getMetrics() {
    const uptime = Date.now() - this.startTime;
    
    // Calculate percentiles for each endpoint
    const responseTimePercentiles = {};
    Object.keys(this.metrics.responseTimes.byEndpoint).forEach(endpoint => {
      const times = this.metrics.responseTimes.byEndpoint[endpoint];
      responseTimePercentiles[endpoint] = {
        count: times.length,
        avg: times.reduce((a, b) => a + b, 0) / times.length,
        min: Math.min(...times),
        max: Math.max(...times),
        ...this.calculatePercentiles(times)
      };
    });
    
    // Cache hit rate
    const cacheTotal = this.metrics.cache.hits + this.metrics.cache.misses;
    const cacheHitRate = cacheTotal > 0 
      ? (this.metrics.cache.hits / cacheTotal * 100).toFixed(2) 
      : 0;
    
    return {
      uptime: Math.floor(uptime / 1000), // seconds
      requests: {
        total: this.metrics.requests.total,
        perSecond: (this.metrics.requests.total / (uptime / 1000)).toFixed(2),
        byMethod: this.metrics.requests.byMethod,
        byStatus: this.metrics.requests.byStatus,
        topEndpoints: Object.entries(this.metrics.requests.byEndpoint)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([endpoint, count]) => ({ endpoint, count }))
      },
      responseTimes: {
        percentiles: responseTimePercentiles,
        slowestEndpoints: Object.entries(responseTimePercentiles)
          .sort((a, b) => (b[1].p95 || 0) - (a[1].p95 || 0))
          .slice(0, 5)
          .map(([endpoint, stats]) => ({ endpoint, ...stats }))
      },
      errors: {
        total: this.metrics.errors.total,
        rate: this.metrics.requests.total > 0 
          ? ((this.metrics.errors.total / this.metrics.requests.total) * 100).toFixed(2) + '%'
          : '0%',
        byEndpoint: this.metrics.errors.byEndpoint
      },
      cache: {
        hits: this.metrics.cache.hits,
        misses: this.metrics.cache.misses,
        hitRate: cacheHitRate + '%',
        effectiveness: cacheHitRate > 80 ? 'good' : cacheHitRate > 50 ? 'fair' : 'poor'
      },
      database: {
        queries: this.metrics.database.queries,
        slowQueries: this.metrics.database.slowQueries,
        slowQueryRate: this.metrics.database.queries > 0
          ? ((this.metrics.database.slowQueries / this.metrics.database.queries) * 100).toFixed(2) + '%'
          : '0%'
      }
    };
  }

  /**
   * Reset metrics
   */
  reset() {
    this.metrics = {
      requests: { total: 0, byMethod: {}, byEndpoint: {}, byStatus: {} },
      responseTimes: { byEndpoint: {}, percentiles: {} },
      errors: { total: 0, byType: {}, byEndpoint: {} },
      cache: { hits: 0, misses: 0 },
      database: { queries: 0, slowQueries: 0 }
    };
    this.startTime = Date.now();
  }
}

// Singleton instance
const metricsCollector = new MetricsCollector();

/**
 * Metrics middleware
 */
function metricsMiddleware(req, res, next) {
  if (!featureFlags.isEnabled('ENABLE_METRICS')) {
    return next();
  }

  const startTime = Date.now();
  
  // Record original end function
  const originalEnd = res.end;
  
  res.end = function(...args) {
    const duration = Date.now() - startTime;
    metricsCollector.recordRequest(
      req.method,
      req.path,
      res.statusCode,
      duration
    );
    
    originalEnd.apply(this, args);
  };
  
  next();
}

module.exports = {
  metricsMiddleware,
  metricsCollector
};
