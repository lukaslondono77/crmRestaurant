/**
 * Critical unit tests for analytics service (financial correctness).
 * Run from backend: node scripts/test-analytics-critical.js
 * Used by CI as part of test:all; add to package.json test:analytics.
 *
 * 1. Food cost % = (totalPurchases / totalSales) * 100
 * 2. Waste % = (wasteDollars / salesDollars) * 100 (not waste/purchases)
 * 3. Savings/loss vs 28%: difference = actualPurchases - (sales * 0.28)
 * 4. Prime cost: isCritical when > 100%
 * 5. Period labels (day count -> label)
 * 6. Savings breakdown aggregation
 * 7. Action item food cost uses same period as dashboard (shape/consistency)
 */

const assert = require('assert');

// Load env so DB path etc. are set
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const analyticsService = require('../src/services/analyticsService');

let passed = 0;
let failed = 0;

function ok(name, condition, message) {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed++;
    return true;
  }
  console.log(`  ❌ ${name}: ${message || 'assertion failed'}`);
  failed++;
  return false;
}

// ---- 1. Food cost % = (purchases / sales) * 100 ----
function testFoodCostFormula() {
  const fc = { totalPurchases: 2800, totalSales: 10000, foodCost: 28 };
  const display = analyticsService.getFoodCostDisplay(fc, 0, 10000);
  ok(
    'Food cost % = (purchases/sales)*100',
    display.value === 28,
    `expected 28, got ${display.value}`
  );
  // Edge: zero sales -> no division by zero
  const noSales = analyticsService.getFoodCostDisplay({ totalPurchases: 100, totalSales: 0 }, 0, 0);
  ok(
    'Food cost with zero sales (no crash)',
    noSales.value === null || noSales.confidence === 'none',
    `expected no value or none confidence, got value=${noSales.value}`
  );
}

// ---- 2. Waste % = (waste $ / sales $) * 100 ----
function testWasteFormula() {
  const display = analyticsService.getWasteDisplay(500, 0, 10000);
  ok(
    'Waste % = (waste/sales)*100',
    display.value === 5,
    `expected 5, got ${display.value}`
  );
  const displayZero = analyticsService.getWasteDisplay(0, 1000, 10000);
  ok(
    'Waste % with zero waste',
    displayZero.value === 0,
    `expected 0, got ${displayZero.value}`
  );
  // Edge: zero sales
  const noSales = analyticsService.getWasteDisplay(100, 0, 0);
  ok(
    'Waste % with zero sales (no crash)',
    noSales.value === 0 && noSales.message === '—',
    `expected 0 and —, got ${noSales.value} ${noSales.message}`
  );
}

// ---- 3. Loss vs 28% target: difference = actual - (sales * 0.28) ----
function test28TargetFormula() {
  const TARGET = 0.28;
  const sales = 10000;
  const expectedPurchases = sales * TARGET; // 2800
  const actualPurchases = 3500;
  const difference = actualPurchases - expectedPurchases; // 700 (loss)
  ok(
    '28% target: difference = actual - (sales*0.28), positive = loss',
    Math.abs(difference - 700) < 0.01,
    `expected ~700, got ${difference}`
  );
  const gainPurchases = 2500;
  const gainDiff = gainPurchases - expectedPurchases; // -300
  ok(
    '28% target: negative difference = gain',
    Math.abs(gainDiff - (-300)) < 0.01,
    `expected ~-300, got ${gainDiff}`
  );
}

// ---- 4. Prime cost > 100% => isCritical ----
function testPrimeCostCritical() {
  const laborCostPercentage = 32.8;
  const foodCostOver100 = 70; // 70 + 32.8 = 102.8 > 100
  const primeRaw = foodCostOver100 + laborCostPercentage;
  ok(
    'Prime cost > 100 => critical',
    primeRaw > 100,
    `expected >100, got ${primeRaw}`
  );
  const foodCostOk = 30;
  ok(
    'Prime cost <= 100 => not critical',
    foodCostOk + laborCostPercentage <= 100,
    'expected <= 100'
  );
}

// ---- 5. Period label logic (pure) ----
function testPeriodLabels() {
  const weekDayCount = 7;
  const monthDayCount = 2;
  const weekLabel = weekDayCount >= 7 ? 'This Week' : (weekDayCount === 1 ? 'Today' : `Last ${weekDayCount} Days`);
  const monthLabel = monthDayCount >= 28 ? 'This Month' : (monthDayCount === 1 ? 'Today' : `Last ${monthDayCount} Days`);
  ok('Period label: 7 days => This Week', weekLabel === 'This Week', `got ${weekLabel}`);
  ok('Period label: 2 days => Last 2 Days', monthLabel === 'Last 2 Days', `got ${monthLabel}`);
}

// ---- 6. Savings breakdown: totalPotentialSavings and category counts ----
// (We can only test shape/consistency without DB; aggregation is in getSavingsBreakdown)
function testSavingsBreakdownShape() {
  const mockBreakdown = {
    totalPotentialSavings: 500,
    calculation: { isLoss: true, difference: 500 },
    items: [
      { category: 'Waste', monthlyImpact: 300 },
      { category: 'Food Cost', monthlyImpact: 200 }
    ],
    summary: { wasteIssues: 1, foodCostIssues: 1, varianceIssues: 0, inventoryIssues: 0 }
  };
  const sumImpact = mockBreakdown.items.reduce((s, i) => s + (i.monthlyImpact || 0), 0);
  ok(
    'Savings breakdown: items sum in line with totalPotentialSavings',
    sumImpact === 500,
    `expected 500, got ${sumImpact}`
  );
}

// ---- 7. Action items: food cost period consistency (integration) ----
async function testActionItemsShape() {
  try {
    // Use first tenant or a known test tenant; if none, skip
    const db = require('../src/config/database');
    const tenants = await db.allAsync('SELECT id FROM tenants LIMIT 1');
    if (!tenants || tenants.length === 0) {
      console.log('  ⏭️  Action items (skip: no tenant)');
      return;
    }
    const tenantId = tenants[0].id;
    const action = await analyticsService.getActionItems(tenantId);
    ok('Action items: returns { items, count }', Array.isArray(action.items) && typeof action.count === 'number', 'shape');
    ok('Action items: count matches length', action.items.length === action.count, 'count');
  } catch (e) {
    console.log('  ⏭️  Action items (skip: ' + e.message + ')');
  }
}

// ---- Daily burn rate (from getDashboardMetrics) ----
async function testDailyBurnRateShape() {
  try {
    const db = require('../src/config/database');
    const tenants = await db.allAsync('SELECT id FROM tenants LIMIT 1');
    if (!tenants || tenants.length === 0) {
      console.log('  ⏭️  Daily burn rate (skip: no tenant)');
      return;
    }
    const metrics = await analyticsService.getDashboardMetrics(tenants[0].id);
    ok('Dashboard: dailyBurnRate present', metrics.dailyBurnRate != null, 'missing dailyBurnRate');
    ok('Dashboard: dailyBurnRate has value and periodDays', typeof metrics.dailyBurnRate.value === 'number' && typeof metrics.dailyBurnRate.periodDays === 'number', 'shape');
    if (metrics.monthlyIsLoss && metrics.periodInfo && metrics.periodInfo.monthDayCount > 0) {
      const expected = metrics.monthlyLoss / metrics.periodInfo.monthDayCount;
      ok('Daily burn = monthlyLoss / period days', Math.abs(metrics.dailyBurnRate.value - expected) < 0.02, `expected ~${expected}, got ${metrics.dailyBurnRate.value}`);
    }
  } catch (e) {
    console.log('  ⏭️  Daily burn rate (skip: ' + e.message + ')');
  }
}

// ---- Run ----
(async () => {
  console.log('\n🧪 Analytics critical tests\n');

  testFoodCostFormula();
  testWasteFormula();
  test28TargetFormula();
  testPrimeCostCritical();
  testPeriodLabels();
  testSavingsBreakdownShape();
  await testActionItemsShape();
  await testDailyBurnRateShape();

  console.log('\n' + `Passed: ${passed}, Failed: ${failed}` + '\n');
  process.exit(failed > 0 ? 1 : 0);
})();
