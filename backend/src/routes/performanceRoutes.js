/**
 * Performance Monitoring Routes
 * Provides endpoints for metrics, health checks, and feature flags
 */

const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { metricsCollector } = require('../middleware/metrics');
const featureFlags = require('../utils/featureFlags');
const cacheService = require('../services/cacheService');
const { getCircuitBreakerStatuses } = require('../middleware/circuitBreaker');
const db = require('../config/database');
const { formatSuccessResponse } = require('../utils/errorHandler');

const router = express.Router();

/**
 * GET /api/performance/health
 * Enhanced health check with performance metrics
 */
router.get('/health', async (req, res) => {
  const health = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    checks: {},
    performance: {}
  };

  // Database check
  try {
    const start = Date.now();
    await db.getAsync('SELECT 1');
    const dbTime = Date.now() - start;
    health.checks.database = 'OK';
    health.performance.databaseResponseTime = dbTime;
    
    // Check if indexes exist
    const indexes = await db.allAsync(`
      SELECT COUNT(*) as count 
      FROM sqlite_master 
      WHERE type='index' AND name LIKE 'idx_%'
    `);
    health.checks.indexes = indexes[0]?.count > 0 ? 'OK' : 'MISSING';
    health.performance.indexCount = indexes[0]?.count || 0;
  } catch (error) {
    health.checks.database = 'FAIL';
    health.status = 'DEGRADED';
    health.checks.databaseError = error.message;
  }

  // Memory check
  const memUsage = process.memoryUsage();
  health.memory = {
    used: Math.round(memUsage.heapUsed / 1024 / 1024),
    total: Math.round(memUsage.heapTotal / 1024 / 1024),
    external: Math.round(memUsage.external / 1024 / 1024),
    rss: Math.round(memUsage.rss / 1024 / 1024)
  };

  // Cache stats
  try {
    const cacheStats = cacheService.getStats();
    health.cache = cacheStats;
    health.performance.cacheHitRate = cacheStats.active > 0 
      ? ((cacheStats.active / (cacheStats.active + cacheStats.expired)) * 100).toFixed(2) + '%'
      : 'N/A';
  } catch (error) {
    health.cache = { error: 'Not available' };
  }

  // Metrics summary
  try {
    const metrics = metricsCollector.getMetrics();
    health.performance.metrics = {
      requestsPerSecond: metrics.requests.perSecond,
      errorRate: metrics.errors.rate,
      cacheHitRate: metrics.cache.hitRate,
      slowQueryRate: metrics.database.slowQueryRate
    };
  } catch (error) {
    health.performance.metrics = { error: 'Not available' };
  }

  const statusCode = health.status === 'OK' ? 200 : 503;
  res.status(statusCode).json(formatSuccessResponse(health));
});

/**
 * GET /api/performance/metrics
 * Get detailed performance metrics (admin only)
 */
router.get('/metrics', authenticate, authorize('admin'), (req, res) => {
  const metrics = metricsCollector.getMetrics();
  res.json(formatSuccessResponse(metrics));
});

/**
 * GET /api/performance/feature-flags
 * Get current feature flags (admin only)
 */
router.get('/feature-flags', authenticate, authorize('admin'), (req, res) => {
  const flags = featureFlags.getAll();
  res.json(formatSuccessResponse(flags));
});

/**
 * POST /api/performance/feature-flags
 * Update feature flags (admin only)
 */
router.post('/feature-flags', authenticate, authorize('admin'), (req, res) => {
  const updates = req.body;
  const updated = featureFlags.update(updates);
  res.json(formatSuccessResponse(updated, { message: 'Feature flags updated' }));
});

/**
 * POST /api/performance/reset-metrics
 * Reset metrics counter (admin only)
 */
router.post('/reset-metrics', authenticate, authorize('admin'), (req, res) => {
  metricsCollector.reset();
  res.json(formatSuccessResponse({ message: 'Metrics reset' }));
});

/**
 * GET /api/performance/cache-stats
 * Get cache statistics (admin only)
 */
router.get('/cache-stats', authenticate, authorize('admin'), (req, res) => {
  const stats = cacheService.getStats();
  res.json(formatSuccessResponse(stats));
});

/**
 * POST /api/performance/clear-cache
 * Clear cache (admin only)
 */
router.post('/clear-cache', authenticate, authorize('admin'), (req, res) => {
  const { pattern } = req.body;
  
  if (pattern) {
    const cleared = cacheService.invalidatePattern(pattern);
    res.json(formatSuccessResponse({ 
      message: `Cache cleared for pattern: ${pattern}`,
      cleared: cleared
    }));
  } else {
    cacheService.clear();
    res.json(formatSuccessResponse({ message: 'All cache cleared' }));
  }
});

/**
 * GET /api/performance/circuit-breakers
 * Get circuit breaker statuses (admin only)
 */
router.get('/circuit-breakers', authenticate, authorize('admin'), (req, res) => {
  const statuses = getCircuitBreakerStatuses();
  res.json(formatSuccessResponse(statuses));
});

/**
 * GET /api/performance/slow-queries
 * Get slow query analysis (admin only)
 */
router.get('/slow-queries', authenticate, authorize('admin'), async (req, res) => {
  try {
    // Get query plan for common queries
    const testQueries = [
      {
        name: 'Inventory by tenant',
        sql: 'SELECT * FROM inventory WHERE tenant_id = ? LIMIT 10',
        params: [1]
      },
      {
        name: 'Sales by date range',
        sql: 'SELECT * FROM sales WHERE tenant_id = ? AND report_date BETWEEN ? AND ? LIMIT 10',
        params: [1, '2024-01-01', '2024-12-31']
      }
    ];

    const results = [];
    
    for (const query of testQueries) {
      const plan = await db.allAsync(`EXPLAIN QUERY PLAN ${query.sql}`, query.params);
      const start = Date.now();
      await db.allAsync(query.sql, query.params);
      const duration = Date.now() - start;
      
      results.push({
        name: query.name,
        duration,
        plan: plan.map(p => ({
          detail: p.detail,
          order: p.order
        }))
      });
    }

    res.json(formatSuccessResponse({ queries: results }));
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { message: error.message }
    });
  }
});

module.exports = router;
