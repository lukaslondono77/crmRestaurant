/**
 * Food cost calculation and display (extracted from analyticsService).
 * API: calculateFoodCost(tenantId, startDate, endDate), getFoodCostDisplay(foodCostResult, wasteTotal, totalSales).
 */

const db = require('../../config/database');
const cacheService = require('../cacheService');
const featureFlags = require('../../utils/featureFlags');
const { metricsCollector } = require('../../middleware/metrics');

async function calculateFoodCost(tenantId, startDate, endDate) {
  const cacheKey = `food_cost:${tenantId}:${startDate}:${endDate}`;

  if (featureFlags.isEnabled('ENABLE_PERFORMANCE_CACHE')) {
    const cached = cacheService.get(cacheKey);
    if (cached) {
      if (metricsCollector && typeof metricsCollector.recordCacheHit === 'function') metricsCollector.recordCacheHit();
      return cached;
    }
    if (metricsCollector && typeof metricsCollector.recordCacheMiss === 'function') metricsCollector.recordCacheMiss();
  }

  if (metricsCollector && typeof metricsCollector.recordDatabaseQuery === 'function') metricsCollector.recordDatabaseQuery();
  const purchases = await db.allAsync(`
    SELECT SUM(total_amount) as total_purchases
    FROM purchases
    WHERE tenant_id = ? AND purchase_date BETWEEN ? AND ?
  `, [tenantId, startDate, endDate]);

  if (metricsCollector && typeof metricsCollector.recordDatabaseQuery === 'function') metricsCollector.recordDatabaseQuery();
  const sales = await db.allAsync(`
    SELECT SUM(total_sales) as total_sales
    FROM sales
    WHERE tenant_id = ? AND report_date BETWEEN ? AND ?
  `, [tenantId, startDate, endDate]);

  const totalPurchases = purchases[0]?.total_purchases || 0;
  const totalSales = sales[0]?.total_sales || 0;
  const foodCost = totalSales > 0 ? (totalPurchases / totalSales) * 100 : 0;

  const result = {
    foodCost: parseFloat(foodCost.toFixed(2)),
    totalPurchases,
    totalSales,
    period: { startDate, endDate }
  };

  if (featureFlags.isEnabled('ENABLE_PERFORMANCE_CACHE')) {
    const ttl = featureFlags.get('CACHE_TTL_ANALYTICS', 600000);
    cacheService.set(cacheKey, result, ttl);
  }

  return result;
}

function getFoodCostDisplay(foodCostResult, wasteTotal, totalSales) {
  const purchases = foodCostResult?.totalPurchases ?? 0;
  const sales = foodCostResult?.totalSales ?? totalSales ?? 0;
  const waste = wasteTotal ?? 0;
  const hasPurchases = purchases > 0;
  const hasSales = sales > 0;
  const hasWaste = waste > 0;

  if (hasPurchases && hasSales) {
    const value = (purchases / sales) * 100;
    return {
      value: parseFloat(value.toFixed(2)),
      confidence: 'medium',
      message: `Estimated: ${value.toFixed(1)}%`,
      tooltip: 'Based on purchases only. Add weekly inventory counts for actual food cost.',
      dataRequirements: 'Supplier invoices + weekly inventory for accuracy'
    };
  }
  if (!hasPurchases && hasSales && hasWaste) {
    const wastePct = (waste / sales) * 100;
    const estimated = 30 + wastePct;
    return {
      value: parseFloat(Math.min(45, Math.max(15, estimated)).toFixed(2)),
      confidence: 'low',
      message: `Rough estimate: ~${estimated.toFixed(0)}% ±5%`,
      tooltip: 'Industry average (30%) + waste impact. Add purchase data for accuracy.',
      dataRequirements: 'Upload supplier invoices'
    };
  }
  if (hasSales && !hasPurchases && !hasWaste) {
    return {
      value: null,
      confidence: 'none',
      message: 'Add data',
      tooltip: 'Upload supplier invoices and track waste to calculate food cost.',
      dataRequirements: 'Supplier invoices, waste logs'
    };
  }
  return {
    value: foodCostResult?.foodCost ?? null,
    confidence: 'none',
    message: 'Add data',
    tooltip: 'Upload invoices and add POS sales to calculate food cost.',
    dataRequirements: 'Sales (POS) + purchases (invoices)'
  };
}

module.exports = {
  calculateFoodCost,
  getFoodCostDisplay
};
