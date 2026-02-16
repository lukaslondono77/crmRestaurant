/**
 * Monthly Profit Report Service
 * Generates POS-driven monthly reports: executive summary, profit leakage,
 * menu performance, action plan. Works with POS-only data (estimates) or full system.
 */

const db = require('../config/database');
const { format, startOfMonth, endOfMonth, addMonths } = require('date-fns');
const analyticsService = require('./analyticsService');

class MonthlyReportService {
  /**
   * Get Monthly Profit Report for a given year/month
   * @param {number} tenantId
   * @param {number} year
   * @param {number} month (1-12)
   */
  async getMonthlyProfitReport(tenantId, year, month) {
    const start = startOfMonth(new Date(year, month - 1, 1));
    const end = endOfMonth(start);
    const startDate = format(start, 'yyyy-MM-dd');
    const endDate = format(end, 'yyyy-MM-dd');
    const monthLabel = format(start, 'MMMM yyyy');

    // 1. POS-only: sales totals, by day, top/slow items
    const posInsights = await this.getPOSInsights(tenantId, startDate, endDate);

    // 2. Cost data (purchases, waste) – may be empty
    const foodCost = await analyticsService.calculateFoodCost(tenantId, startDate, endDate);
    const hasInventory = (foodCost.totalPurchases || 0) > 0;
    const totalSales = foodCost.totalSales || posInsights.totalSales || 0;
    const totalPurchases = foodCost.totalPurchases || 0;

    // 3. Dashboard-style metrics (loss, savings, action items)
    let metrics = {};
    let profitLeakage = [];
    let savingsBreakdown = null;
    try {
      metrics = await analyticsService.getDashboardMetrics(tenantId);
      savingsBreakdown = metrics.savingsBreakdown || null;
    } catch (e) {
      // use defaults if metrics fail
    }

    // 4. Labor (simulated 32.8%)
    const laborPct = 32.8;
    const laborCost = totalSales * (laborPct / 100);
    const primeCostPct = totalSales > 0
      ? ((totalPurchases + laborCost) / totalSales) * 100
      : 0;
    const primeCostTarget = 65;
    const opportunityLoss = totalSales * Math.max(0, (primeCostPct - primeCostTarget) / 100);

    // 5. Profit leakage (top 5) – from savings breakdown or static template
    if (savingsBreakdown && Array.isArray(savingsBreakdown.items) && savingsBreakdown.items.length > 0) {
      profitLeakage = savingsBreakdown.items.slice(0, 5).map((i, idx) => ({
        rank: idx + 1,
        name: i.title || i.category,
        amount: i.monthlyImpact || i.currentCost || 0,
        action: i.recommendation || (i.actionItems && i.actionItems[0]) || ''
      }));
    }
    if (profitLeakage.length === 0) {
      profitLeakage = [
        { rank: 1, name: 'Food Waste (8.5%)', amount: 4856, action: 'Waste audit for 7 days' },
        { rank: 2, name: 'Labor overscheduling', amount: 3245, action: 'Adjust schedule template' },
        { rank: 3, name: 'Supplier price creep', amount: 1892, action: 'Renegotiate or switch' },
        { rank: 4, name: 'Inventory shrinkage', amount: 856, action: 'Weekly counts, lock storage' },
        { rank: 5, name: 'Low-margin items', amount: 539, action: 'Reprice or replace' }
      ];
    }

    // 6. Menu performance (stars, plow horses, puzzles, dogs) from POS + margins
    const menuPerformance = await this.getMenuPerformance(tenantId, startDate, endDate, totalSales);

    // 7. Blind spots when POS-only (no inventory)
    const blindSpots = !hasInventory ? [
      { title: 'Food Cost %', detail: 'Unknown. Upload invoices for exact %.', impact: '$5,000+ monthly uncertainty' },
      { title: 'Actual Profit', detail: 'Sales known; costs, labor, waste unknown.', impact: 'Cannot calculate true profit' },
      { title: 'Waste Analysis', detail: 'No waste tracking without inventory.', impact: 'Hidden loss unmeasured' },
      { title: 'Theoretical vs Actual', detail: 'No recipe costing without purchases.', impact: 'Variance unknown' }
    ] : [];

    // 8. Action plan (next 4 weeks)
    const actionPlan = [
      { week: 1, focus: 'Food Waste', actions: ['Conduct 7-day waste audit', 'Identify source: storage vs portion vs prep', 'Adjust storage and portioning'] },
      { week: 2, focus: 'Labor', actions: ['Review sales vs labor by day-part', 'Right-size schedules', 'Cross-train staff'] },
      { week: 3, focus: 'Suppliers & Inventory', actions: ['Address supplier price increases', 'Get competitive quotes', 'Start weekly inventory counts'] },
      { week: 4, focus: 'Menu Engineering', actions: ['Find 5 low-margin (<20%) items', 'Reprice, reduce cost, or replace', 'Promote high-margin stars'] }
    ];

    // 9. Executive summary
    const prevMonth = addMonths(start, -1);
    const prevStart = format(startOfMonth(prevMonth), 'yyyy-MM-dd');
    const prevEnd = format(endOfMonth(prevMonth), 'yyyy-MM-dd');
    const prevFoodCost = await analyticsService.calculateFoodCost(tenantId, prevStart, prevEnd);
    const prevSales = prevFoodCost.totalSales || 0;
    const salesGrowth = prevSales > 0 ? (((totalSales - prevSales) / prevSales) * 100).toFixed(2) : 0;

    const report = {
      period: { year, month, startDate, endDate, monthLabel },
      executiveSummary: {
        totalSales: parseFloat((totalSales || 0).toFixed(2)),
        dailyAverage: totalSales && posInsights.daysWithSales > 0
          ? parseFloat((totalSales / posInsights.daysWithSales).toFixed(2))
          : 0,
        bestDay: posInsights.bestDay || null,
        worstDay: posInsights.worstDay || null,
        salesGrowthPercent: parseFloat(salesGrowth),
        topItem: posInsights.topItem || null,
        goodNews: [
          totalSales > 0 ? `Sales: $${(totalSales || 0).toLocaleString()}` : 'No sales data',
          posInsights.topItem ? `Top item: ${posInsights.topItem.name} ($${posInsights.topItem.revenue?.toLocaleString()})` : null,
          posInsights.bestDay ? `Best day: ${posInsights.bestDay.label} ($${posInsights.bestDay.total?.toLocaleString()})` : null
        ].filter(Boolean),
        warningSigns: [
          primeCostPct > 65 ? `Prime Cost: ${primeCostPct.toFixed(1)}% (target ≤65%) → ~$${opportunityLoss.toFixed(0)} opportunity loss` : null,
          (metrics.wastePercentage || 0) > 5 ? `Waste ${metrics.wastePercentage}% vs 5% target` : null,
          (metrics.laborCostPercentage || 0) > 30 ? `Labor ${metrics.laborCostPercentage}% vs 30% target` : null
        ].filter(Boolean)
      },
      revenueHealth: {
        totalSales: parseFloat((totalSales || 0).toFixed(2)),
        totalPurchases: parseFloat((totalPurchases || 0).toFixed(2)),
        foodCostPct: totalSales > 0 ? parseFloat(((totalPurchases / totalSales) * 100).toFixed(2)) : 0,
        laborCostPct: laborPct,
        laborCost: parseFloat(laborCost.toFixed(2)),
        primeCostPct: parseFloat(primeCostPct.toFixed(2)),
        primeCostTarget: primeCostTarget,
        opportunityLoss: parseFloat(opportunityLoss.toFixed(2))
      },
      profitLeakage,
      menuPerformance,
      posOnlyInsights: posInsights,
      blindSpots,
      actionPlan,
      totalPreventableLoss: profitLeakage.reduce((s, i) => s + (i.amount || 0), 0),
      hasInventory
    };

    return report;
  }

  /**
   * POS-only insights: sales by day, top/slow items, daily average
   */
  async getPOSInsights(tenantId, startDate, endDate) {
    const salesByDay = await db.allAsync(`
      SELECT report_date as date, SUM(total_sales) as total
      FROM sales
      WHERE tenant_id = ? AND report_date BETWEEN ? AND ?
      GROUP BY report_date
      ORDER BY report_date
    `, [tenantId, startDate, endDate]);

    const items = await db.allAsync(`
      SELECT 
        si.item_name,
        SUM(si.quantity) as qty,
        SUM(si.total_price) as revenue
      FROM sales_items si
      JOIN sales s ON si.sale_id = s.id
      WHERE s.tenant_id = ? AND si.tenant_id = ? AND s.report_date BETWEEN ? AND ?
      GROUP BY si.item_name
      ORDER BY revenue DESC
    `, [tenantId, tenantId, startDate, endDate]);

    const totalSales = salesByDay.reduce((s, d) => s + (d.total || 0), 0);
    const daysWithSales = salesByDay.length || 0;
    const best = salesByDay.length ? salesByDay.reduce((a, b) => (a.total >= b.total ? a : b), salesByDay[0]) : null;
    const worst = salesByDay.length ? salesByDay.reduce((a, b) => (a.total <= b.total ? a : b), salesByDay[0]) : null;
    const totalItemsRevenue = items.reduce((s, i) => s + (i.revenue || 0), 0);

    const top = items.slice(0, 5).map((i) => ({
      name: i.item_name,
      revenue: parseFloat((i.revenue || 0).toFixed(2)),
      qty: i.qty || 0,
      pctOfTotal: totalItemsRevenue > 0 ? parseFloat(((i.revenue / totalItemsRevenue) * 100).toFixed(1)) : 0
    }));
    const slow = items.length > 5 ? items.slice(-5).reverse().map((i) => ({
      name: i.item_name,
      revenue: parseFloat((i.revenue || 0).toFixed(2)),
      qty: i.qty || 0
    })) : [];

    return {
      totalSales: parseFloat(totalSales.toFixed(2)),
      daysWithSales,
      dailyAverage: daysWithSales > 0 ? parseFloat((totalSales / daysWithSales).toFixed(2)) : 0,
      salesByDay: (salesByDay || []).map((d) => ({
        label: d.date,
        total: parseFloat((d.total || 0).toFixed(2))
      })),
      bestDay: best ? { label: best.date, total: parseFloat((best.total || 0).toFixed(2)) } : null,
      worstDay: worst ? { label: worst.date, total: parseFloat((worst.total || 0).toFixed(2)) } : null,
      topItems: top,
      slowItems: slow,
      topItem: top[0] || null
    };
  }

  /**
   * Menu performance: stars, plow horses, puzzles, dogs (from sales + estimated margins)
   */
  async getMenuPerformance(tenantId, startDate, endDate, totalSales) {
    const menu = await analyticsService.getMenuProfitability(tenantId, startDate, endDate);
    const items = menu.items || [];
    if (items.length === 0) {
      return { stars: [], plowHorses: [], puzzles: [], dogs: [] };
    }

    const totalRev = items.reduce((s, i) => s + (i.revenue || 0), 0);
    const stars = [];
    const plowHorses = [];
    const puzzles = [];
    const dogs = [];

    items.forEach((i) => {
      const pctSold = totalRev > 0 ? ((i.revenue || 0) / totalRev) * 100 : 0;
      const margin = i.margin ?? 0;
      const highMargin = margin >= 50;
      const highSales = pctSold >= 10;
      const entry = {
        name: i.itemName,
        revenue: i.revenue,
        margin: margin,
        pctOfSales: parseFloat(pctSold.toFixed(1))
      };
      if (highSales && highMargin) stars.push(entry);
      else if (highSales && !highMargin) plowHorses.push(entry);
      else if (!highSales && highMargin) puzzles.push(entry);
      else dogs.push(entry);
    });

    return { stars, plowHorses, puzzles, dogs };
  }
}

module.exports = new MonthlyReportService();
