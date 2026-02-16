/**
 * Owner-First Dashboard: executive summary, crisis banner, Priority 1 Today.
 * GET /api/dashboard/executive-summary
 */

const db = require('../config/database');
const { format, subDays } = require('date-fns');
const analyticsService = require('./analyticsService');

const LABOR_COST_PERCENT = 32.8;
const TARGET_FOOD_COST = 28;
const DAYS_FOR_CONSECUTIVE = 3;
const LAST_N_DAYS = 7;

/**
 * Get daily metrics for the last 7 days (for crisis banner 3-day consecutive rules).
 */
async function getDailyMetricsForCrisis(tenantId) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const start = format(subDays(new Date(), LAST_N_DAYS - 1), 'yyyy-MM-dd');

  const salesByDay = await db.allAsync(`
    SELECT report_date as date, COALESCE(SUM(total_sales), 0) as total_sales
    FROM sales WHERE tenant_id = ? AND report_date BETWEEN ? AND ?
    GROUP BY report_date
  `, [tenantId, start, today]);

  const purchasesByDay = await db.allAsync(`
    SELECT purchase_date as date, COALESCE(SUM(total_amount), 0) as total_purchases
    FROM purchases WHERE tenant_id = ? AND purchase_date BETWEEN ? AND ?
    GROUP BY purchase_date
  `, [tenantId, start, today]);

  const wasteByDay = await db.allAsync(`
    SELECT waste_date as date, COALESCE(SUM(cost_value), 0) as total_waste
    FROM waste WHERE tenant_id = ? AND waste_date BETWEEN ? AND ?
    GROUP BY waste_date
  `, [tenantId, start, today]);

  const salesMap = {};
  salesByDay.forEach(r => { salesMap[r.date] = Number(r.total_sales) || 0; });
  const purchasesMap = {};
  purchasesByDay.forEach(r => { purchasesMap[r.date] = Number(r.total_purchases) || 0; });
  const wasteMap = {};
  wasteByDay.forEach(r => { wasteMap[r.date] = Number(r.total_waste) || 0; });

  const days = [];
  for (let i = 0; i < LAST_N_DAYS; i++) {
    const d = format(subDays(new Date(), LAST_N_DAYS - 1 - i), 'yyyy-MM-dd');
    const sales = salesMap[d] || 0;
    const purchases = purchasesMap[d] || 0;
    const waste = wasteMap[d] || 0;
    const foodCostPct = sales > 0 ? (purchases / sales) * 100 : 0;
    const wastePct = sales > 0 ? (waste / sales) * 100 : 0;
    const primeCost = foodCostPct + LABOR_COST_PERCENT;
    days.push({
      date: d,
      sales,
      purchases,
      waste,
      foodCostPct,
      wastePct,
      primeCost
    });
  }
  return days;
}

/**
 * Check if condition holds for at least 3 consecutive days.
 */
function hasConsecutiveDays(days, predicate) {
  let count = 0;
  for (const day of days) {
    if (predicate(day)) {
      count++;
      if (count >= DAYS_FOR_CONSECUTIVE) return true;
    } else {
      count = 0;
    }
  }
  return false;
}

/**
 * Crisis banner: one banner, priority order Prime>100% → Prime>68% 3d → Food>35% 3d → Waste>10% 3d → No data.
 */
async function getCrisisBanner(tenantId) {
  const days = await getDailyMetricsForCrisis(tenantId);
  const hasAnySales = days.some(d => d.sales > 0);
  const hasAnyPurchases = days.some(d => d.purchases > 0);

  if (!hasAnySales || !hasAnyPurchases) {
    return {
      visible: true,
      severity: 'gray',
      message: 'Add sales and purchase data to see your financial health.',
      rule: 'NO_DATA'
    };
  }

  const primeOver100 = days.some(d => d.primeCost > 100);
  if (primeOver100) {
    return {
      visible: true,
      severity: 'red',
      message: 'Prime Cost over 100% — business is losing money on food + labor.',
      rule: 'PRIME_COST_OVER_100'
    };
  }

  if (hasConsecutiveDays(days, d => d.primeCost > 68)) {
    return {
      visible: true,
      severity: 'red',
      message: 'Prime Cost has been over 68% for 3 days. Immediate action recommended.',
      rule: 'PRIME_COST_3_DAYS'
    };
  }

  if (hasConsecutiveDays(days, d => d.foodCostPct > 35)) {
    return {
      visible: true,
      severity: 'amber',
      message: 'Food cost has been over 35% for 3 days.',
      rule: 'FOOD_COST_3_DAYS'
    };
  }

  if (hasConsecutiveDays(days, d => d.wastePct > 10)) {
    return {
      visible: true,
      severity: 'amber',
      message: 'Waste has been over 10% for 3 days.',
      rule: 'WASTE_3_DAYS'
    };
  }

  return { visible: false, severity: null, message: null, rule: null };
}

/**
 * Priority 1 Today: single action by spec order (first match wins).
 * Uses period-aligned weekly metrics.
 */
async function getPriorityOneAction(tenantId) {
  const metrics = await analyticsService.getDashboardMetrics(tenantId, 'weekly');
  const actionItems = await analyticsService.getActionItems(tenantId);
  const expiringItems = await analyticsService.getExpiringItemsAlerts(tenantId, 7);

  const period = metrics.periodInfo || {};
  const monthStart = period.monthStart;
  const monthEnd = period.monthEnd || format(new Date(), 'yyyy-MM-dd');
  const periodLabel = period.monthPeriodLabel || 'This period';
  const wastePct = metrics.wastePercentage ?? 0;
  const wasteCost = metrics.wasteCost ?? 0;
  const foodCostPct = metrics.foodCostPercentage ?? 0;
  const monthlyLoss = metrics.monthlyLoss ?? 0;
  const monthlyIsLoss = metrics.monthlyIsLoss;
  const savingsBreakdown = metrics.savingsBreakdown;
  const totalSales = metrics.monthlySales ?? 0;
  const TARGET = 0.28;
  const expectedPurchases = totalSales * TARGET;
  const actualPurchases = (metrics.lossSummary && metrics.lossSummary.actualCost) || 0;
  const foodCostOverrun = monthlyIsLoss ? Math.max(0, actualPurchases - expectedPurchases) : 0;

  // Largest cost driver from breakdown (by $ impact)
  let wasteImpact = 0;
  let foodCostImpact = 0;
  if (savingsBreakdown && savingsBreakdown.items) {
    savingsBreakdown.items.forEach(it => {
      const impact = it.monthlyImpact || it.currentCost || 0;
      if (it.category === 'Waste') wasteImpact += impact;
      if (it.category === 'Food Cost') foodCostImpact += impact;
    });
  }
  const wasteIsLargest = wasteImpact >= foodCostImpact && wasteImpact > 0;

  // 1. Reduce Waste
  if (wastePct > 5 && wasteIsLargest && wasteCost > 0) {
    return {
      id: 'REDUCE_WASTE',
      title: 'Reduce Waste',
      description: `Waste is ${wastePct.toFixed(1)}% of sales this period.`,
      actionLabel: 'Reduce Waste →',
      actionUrl: '/#/reports',
      potentialSavings: Math.round(wasteCost),
      category: 'Waste'
    };
  }

  // 2. Adjust Ordering
  if (foodCostPct > TARGET * 100 && foodCostOverrun > 0 && foodCostImpact >= wasteImpact) {
    return {
      id: 'ADJUST_ORDERING',
      title: 'Adjust Ordering',
      description: `Food cost is ${foodCostPct.toFixed(1)}% (target ${TARGET * 100}%).`,
      actionLabel: 'Review Purchasing →',
      actionUrl: '/#/invoices',
      potentialSavings: Math.round(foodCostOverrun),
      category: 'Food Cost'
    };
  }

  // 3. Review Invoice (simplified: if we have variance or high food cost we already suggested ordering; skip unless we add invoice status)
  // Skip for MVP or add: unpaid invoices check.

  // 4. Use Expiring Inventory
  const expiringValue = expiringItems.reduce((sum, i) => sum + (i.valueAtRisk || 0), 0);
  if (expiringItems.length > 0 && expiringValue >= 50) {
    return {
      id: 'USE_EXPIRING_INVENTORY',
      title: 'Use Expiring Inventory',
      description: `${expiringItems.length} items ($${expiringValue.toFixed(0)} value) expire within 7 days.`,
      actionLabel: 'View Expiring Items →',
      actionUrl: '/#/inventory',
      potentialSavings: Math.round(expiringValue),
      category: 'Inventory'
    };
  }

  // 5. Restock Critical Items
  const lowStock = actionItems.items.find(i => i.id === 'LOW_STOCK');
  if (lowStock) {
    return {
      id: 'RESTOCK_CRITICAL',
      title: 'Restock Critical Items',
      description: lowStock.description || 'Some items are running low.',
      actionLabel: 'Review Inventory →',
      actionUrl: '/#/inventory',
      potentialSavings: 0,
      category: 'Inventory'
    };
  }

  // 6. Default
  return {
    id: 'ON_TRACK',
    title: "You're on track",
    description: 'Review detailed metrics below.',
    actionLabel: 'View Dashboard →',
    actionUrl: '/#/analytics',
    potentialSavings: 0,
    category: null
  };
}

/**
 * Build full executive summary for Owner View.
 */
async function getExecutiveSummary(tenantId) {
  const [metrics, crisisBanner, priorityOne] = await Promise.all([
    analyticsService.getDashboardMetrics(tenantId, 'weekly'),
    getCrisisBanner(tenantId),
    getPriorityOneAction(tenantId)
  ]);

  const periodInfo = metrics.periodInfo || {};
  const monthStart = periodInfo.monthStart;
  const monthEnd = periodInfo.monthEnd || format(new Date(), 'yyyy-MM-dd');
  const monthDayCount = periodInfo.monthDayCount || 1;
  const periodLabel = periodInfo.monthPeriodLabel || 'This period';
  const monthlyLoss = metrics.monthlyLoss ?? 0;
  const monthlyIsLoss = metrics.monthlyIsLoss;
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();

  const dailyBurnRate = metrics.dailyBurnRate || { value: 0, periodDays: monthDayCount, label: 'Daily Burn Rate' };
  const projectedMonthlyPandL = monthDayCount > 0
    ? (monthlyIsLoss ? -1 : 1) * (Math.abs(monthlyLoss) / monthDayCount) * daysInMonth
    : 0;

  let topCostDriverName = 'None';
  let topCostDriverValue = 0;
  if (metrics.savingsBreakdown && metrics.savingsBreakdown.items && metrics.savingsBreakdown.items.length > 0) {
    const top = metrics.savingsBreakdown.items[0];
    topCostDriverName = top.category === 'Waste' ? 'Waste' : top.category === 'Food Cost' ? 'Food cost overrun' : top.category || 'Other';
    topCostDriverValue = top.monthlyImpact || top.currentCost || 0;
  }

  const foodCostCurrent = metrics.foodCostDisplay?.value ?? metrics.foodCostPercentage ?? 0;
  const goal = TARGET_FOOD_COST; // 28%
  const delta = foodCostCurrent > 0 ? parseFloat((foodCostCurrent - goal).toFixed(1)) : 0;

  return {
    crisisBanner: crisisBanner.visible ? crisisBanner : { visible: false, severity: null, message: null, rule: null },
    priorityOne,
    cards: {
      dailyBurnRate: {
        value: dailyBurnRate.value,
        label: dailyBurnRate.label || 'Daily Burn Rate',
        periodDays: monthDayCount
      },
      projectedMonthlyPandL: {
        value: Math.round(projectedMonthlyPandL * 100) / 100,
        isLoss: monthlyIsLoss,
        label: 'Projected Monthly P&L'
      },
      topCostDriver: {
        name: topCostDriverName,
        value: parseFloat(topCostDriverValue.toFixed(2)),
        label: 'Top Cost Driver'
      },
      foodCostVsGoal: {
        current: foodCostCurrent,
        goal,
        delta,
        overGoal: delta > 0
      }
    },
    period: {
      start: monthStart,
      end: monthEnd,
      label: periodLabel
    }
  };
}

module.exports = {
  getCrisisBanner,
  getPriorityOneAction,
  getExecutiveSummary
};
