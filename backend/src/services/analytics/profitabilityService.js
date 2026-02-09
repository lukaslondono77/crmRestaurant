/**
 * Main P&L calculation engine with proper period alignment.
 * All metrics (purchases, sales, waste, labor) use the SAME period.
 */

const db = require('../../config/database');
const { getCurrentPeriod, getPreviousPeriod } = require('./periodService');

const TARGET_FOOD_COST_PERCENT = 28;
const TARGET_LABOR_PERCENT = 30;
const TARGET_WASTE_PERCENT_OF_FOOD = 5; // waste as % of food cost
const LABOR_COST_PERCENT = 32.8;

/**
 * Get purchases total for a date range.
 */
async function getPurchases(tenantId, startDate, endDate) {
  const row = await db.getAsync(`
    SELECT COALESCE(SUM(total_amount), 0) as total
    FROM purchases
    WHERE tenant_id = ? AND purchase_date BETWEEN ? AND ?
  `, [tenantId, startDate, endDate]);
  return { amount: Number(row?.total) || 0 };
}

/**
 * Get sales total for a date range.
 */
async function getSales(tenantId, startDate, endDate) {
  const row = await db.getAsync(`
    SELECT COALESCE(SUM(total_sales), 0) as total
    FROM sales
    WHERE tenant_id = ? AND report_date BETWEEN ? AND ?
  `, [tenantId, startDate, endDate]);
  return { amount: Number(row?.total) || 0 };
}

/**
 * Get waste total for a date range.
 */
async function getWaste(tenantId, startDate, endDate) {
  const row = await db.getAsync(`
    SELECT COALESCE(SUM(cost_value), 0) as total
    FROM waste
    WHERE tenant_id = ? AND waste_date BETWEEN ? AND ?
  `, [tenantId, startDate, endDate]);
  return { amount: Number(row?.total) || 0 };
}

/**
 * Get labor cost for a date range (same period). Placeholder: 32.8% of sales (no labor table).
 */
async function getLaborCost(tenantId, startDate, endDate) {
  const sales = await getSales(tenantId, startDate, endDate);
  const amount = (sales.amount || 0) * (LABOR_COST_PERCENT / 100);
  return { amount: parseFloat(amount.toFixed(2)), percent: LABOR_COST_PERCENT };
}

/**
 * Calculate profit/loss for a single period with all metrics aligned to the same dates.
 * @param {string} tenantId
 * @param {string} periodType - 'weekly' | 'monthly' | 'biweek' | 'quarter'
 * @returns {Promise<Object>} period, sales, totalCost, grossProfit, foodCostPercent, primeCost, dailyBurnRate, breakdown, etc.
 */
async function calculateProfitLoss(tenantId, periodType = 'weekly') {
  const period = getCurrentPeriod(periodType);
  const { startDate, endDate, label, dayCount } = period;

  const [purchases, sales, waste, laborResult] = await Promise.all([
    getPurchases(tenantId, startDate, endDate),
    getSales(tenantId, startDate, endDate),
    getWaste(tenantId, startDate, endDate),
    getLaborCost(tenantId, startDate, endDate)
  ]);

  const salesAmount = sales.amount;
  const purchasesAmount = purchases.amount;
  const wasteAmount = waste.amount;
  const laborAmount = laborResult.amount;

  const totalCost = purchasesAmount + wasteAmount + laborAmount;
  const grossProfit = salesAmount - totalCost;
  const foodCostPercent = salesAmount > 0 ? (purchasesAmount / salesAmount) * 100 : 0;
  const laborPercent = laborResult.percent ?? LABOR_COST_PERCENT;
  const laborCostPercentOfSales = salesAmount > 0 ? (laborAmount / salesAmount) * 100 : 0;
  const primeCostPercent = foodCostPercent + laborPercent;
  const wastePercentOfSales = salesAmount > 0 ? (wasteAmount / salesAmount) * 100 : 0;
  const wastePercentOfFoodCost = purchasesAmount > 0 ? (wasteAmount / purchasesAmount) * 100 : 0;

  const dailyBurnRateValue = dayCount > 0 ? grossProfit / dayCount : 0;
  const isProfitable = grossProfit > 0;
  const foodCostOverTarget = foodCostPercent - TARGET_FOOD_COST_PERCENT;
  const laborOverTarget = laborCostPercentOfSales - TARGET_LABOR_PERCENT;

  return {
    period: {
      type: periodType,
      startDate,
      endDate,
      label,
      dayCount
    },
    sales: parseFloat(salesAmount.toFixed(2)),
    totalCost: parseFloat(totalCost.toFixed(2)),
    grossProfit: parseFloat(grossProfit.toFixed(2)),
    isProfitable,
    foodCostPercent: parseFloat(foodCostPercent.toFixed(2)),
    targetFoodCostPercent: TARGET_FOOD_COST_PERCENT,
    foodCostOverTarget: parseFloat(foodCostOverTarget.toFixed(2)),
    laborCostPercent: parseFloat(laborCostPercentOfSales.toFixed(2)),
    targetLaborCostPercent: TARGET_LABOR_PERCENT,
    laborOverTarget: parseFloat(laborOverTarget.toFixed(2)),
    primeCostPercent: parseFloat(primeCostPercent.toFixed(2)),
    wastePercent: parseFloat(wastePercentOfSales.toFixed(2)),
    wastePercentOfFoodCost: parseFloat(wastePercentOfFoodCost.toFixed(2)),
    targetWastePercentOfFoodCost: TARGET_WASTE_PERCENT_OF_FOOD,
    dailyBurnRate: {
      value: parseFloat(dailyBurnRateValue.toFixed(2)),
      periodDays: dayCount,
      label: dailyBurnRateValue >= 0 ? 'Daily profit' : 'Daily burn rate',
      tooltip: dayCount > 0
        ? `${isProfitable ? 'Profit' : 'Loss'} $${Math.abs(grossProfit).toFixed(2)} ÷ ${dayCount} days = $${Math.abs(dailyBurnRateValue).toFixed(2)}/day`
        : 'No period days'
    },
    costs: {
      purchases: parseFloat(purchasesAmount.toFixed(2)),
      labor: parseFloat(laborAmount.toFixed(2)),
      waste: parseFloat(wasteAmount.toFixed(2)),
      total: parseFloat(totalCost.toFixed(2))
    },
    breakdown: {
      purchases: { amount: parseFloat(purchasesAmount.toFixed(2)) },
      sales: { amount: salesAmount },
      waste: {
        amount: parseFloat(wasteAmount.toFixed(2)),
        percentOfSales: wastePercentOfSales,
        percentOfFoodCost: wastePercentOfFoodCost
      },
      labor: { amount: parseFloat(laborAmount.toFixed(2)), percent: laborPercent }
    },
    crisisIndicators: {
      primeCostAlert: primeCostPercent > 65,
      foodCostAlert: foodCostPercent > 30,
      wasteAlert: wastePercentOfFoodCost > TARGET_WASTE_PERCENT_OF_FOOD,
      negativeCashFlow: dailyBurnRateValue < 0
    }
  };
}

/**
 * Get previous period metrics for comparison (e.g. "vs last week").
 */
async function getPreviousPeriodMetrics(tenantId, periodType = 'weekly') {
  const prev = getPreviousPeriod(periodType);
  const [purchases, sales, waste, laborResult] = await Promise.all([
    getPurchases(tenantId, prev.startDate, prev.endDate),
    getSales(tenantId, prev.startDate, prev.endDate),
    getWaste(tenantId, prev.startDate, prev.endDate),
    getLaborCost(tenantId, prev.startDate, prev.endDate)
  ]);
  const totalCost = purchases.amount + waste.amount + laborResult.amount;
  const grossProfit = sales.amount - totalCost;
  return {
    period: prev,
    sales: sales.amount,
    grossProfit,
    foodCostPercent: sales.amount > 0 ? (purchases.amount / sales.amount) * 100 : 0
  };
}

function effortScore(e) {
  const s = { Low: 0, Medium: 1, High: 2 };
  return s[e] ?? 1;
}

/**
 * Get prioritized actions by impact ($), then effort. Single top action + full list.
 */
function getPriorityAction(metrics) {
  const actions = [];
  const sales = metrics.sales || 0;
  const wasteAmount = metrics.breakdown?.waste?.amount ?? metrics.costs?.waste ?? 0;
  const purchasesAmount = metrics.breakdown?.purchases?.amount ?? metrics.costs?.purchases ?? 0;
  const foodCostPercent = metrics.foodCostPercent ?? 0;
  const laborCostPercent = metrics.laborCostPercent ?? 0;
  const wastePercentOfFoodCost = metrics.wastePercentOfFoodCost ?? 0;

  if (wasteAmount > 0) {
    actions.push({
      id: 'waste-001',
      priority: 1,
      title: `Reduce $${Math.round(wasteAmount)} weekly waste`,
      issue: `Waste = ${wastePercentOfFoodCost.toFixed(0)}% of food cost (target: 5%)`,
      impact: parseFloat(wasteAmount.toFixed(2)),
      impactLabel: `Save up to $${Math.round(wasteAmount)}/week`,
      effort: 'Medium',
      timeframe: '2 weeks',
      steps: [
        'Implement FIFO inventory rotation',
        'Train staff on proper storage',
        'Review portion sizes',
        'Set up waste tracking alerts'
      ],
      category: 'Waste'
    });
  }

  if (foodCostPercent > TARGET_FOOD_COST_PERCENT && sales > 0) {
    const potentialSave = ((foodCostPercent - TARGET_FOOD_COST_PERCENT) / 100) * sales;
    actions.push({
      id: 'food-cost-001',
      priority: 2,
      title: `Reduce food cost from ${foodCostPercent.toFixed(1)}% to ${TARGET_FOOD_COST_PERCENT}%`,
      issue: `Food cost ${(foodCostPercent - TARGET_FOOD_COST_PERCENT).toFixed(1)}% over target`,
      impact: parseFloat(potentialSave.toFixed(2)),
      impactLabel: `~$${Math.round(potentialSave)}/period`,
      effort: 'Hard',
      timeframe: '1 month',
      steps: [
        'Negotiate with top suppliers',
        'Review menu pricing',
        'Find cheaper alternatives for top 3 items'
      ],
      category: 'Food Cost'
    });
  }

  if (laborCostPercent > TARGET_LABOR_PERCENT && sales > 0) {
    const potentialSave = ((laborCostPercent - TARGET_LABOR_PERCENT) / 100) * sales;
    actions.push({
      id: 'labor-001',
      priority: 3,
      title: 'Optimize labor schedule',
      issue: `Labor ${laborCostPercent.toFixed(1)}% vs ${TARGET_LABOR_PERCENT}% target`,
      impact: parseFloat(potentialSave.toFixed(2)),
      impactLabel: `~$${Math.round(potentialSave)}/period`,
      effort: 'Medium',
      timeframe: '1 week',
      steps: [
        'Analyze sales vs labor hours',
        'Adjust shift overlaps',
        'Cross-train staff'
      ],
      category: 'Labor'
    });
  }

  const byImpact = [...actions].sort((a, b) => {
    if (b.impact !== a.impact) return b.impact - a.impact;
    return effortScore(a.effort) - effortScore(b.effort);
  });

  const top = byImpact[0];
  return {
    action: top?.title ?? 'On track',
    impact: top?.impact ?? 0,
    impactLabel: top?.impactLabel ?? '',
    effort: top?.effort ?? 'None',
    issue: top?.issue,
    steps: top?.steps,
    category: top?.category,
    prioritizedActions: byImpact
  };
}

module.exports = {
  calculateProfitLoss,
  getPreviousPeriodMetrics,
  getPriorityAction,
  getPurchases,
  getSales,
  getWaste,
  getLaborCost
};
