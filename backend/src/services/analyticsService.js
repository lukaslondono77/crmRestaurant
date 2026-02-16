const db = require('../config/database');
const { format, parseISO, differenceInDays, startOfWeek, endOfWeek, subDays } = require('date-fns');
const cacheService = require('./cacheService');
const featureFlags = require('../utils/featureFlags');
const { metricsCollector } = require('../middleware/metrics');
const foodCostService = require('./analytics/foodCostService');
const wasteAnalysisService = require('./analytics/wasteAnalysisService');
const profitabilityService = require('./analytics/profitabilityService');

class AnalyticsService {
  /** Delegate to foodCostService */
  async calculateFoodCost(tenantId, startDate, endDate) {
    return foodCostService.calculateFoodCost(tenantId, startDate, endDate);
  }

  /** Delegate to wasteAnalysisService */
  async calculateWaste(tenantId, startDate, endDate) {
    return wasteAnalysisService.calculateWaste(tenantId, startDate, endDate);
  }

  /** Delegate to wasteAnalysisService */
  async getSlowMovingItems(tenantId, daysThreshold = 7) {
    return wasteAnalysisService.getSlowMovingItems(tenantId, daysThreshold);
  }

  /** Delegate to foodCostService */
  getFoodCostDisplay(foodCostResult, wasteTotal, totalSales) {
    return foodCostService.getFoodCostDisplay(foodCostResult, wasteTotal, totalSales);
  }

  /** Delegate to wasteAnalysisService */
  getWasteDisplay(wasteTotal, purchases, sales) {
    return wasteAnalysisService.getWasteDisplay(wasteTotal, purchases, sales);
  }

  /**
   * Get dashboard metrics. Uses period-aligned P&L when periodType is provided (weekly | monthly | quarterly).
   * @param {string} tenantId
   * @param {string} [periodType] - 'weekly' | 'monthly' | 'quarterly' for same-period profitability; omit for legacy monthly-focused metrics.
   */
  async getDashboardMetrics(tenantId, periodType) {
    const supportedPeriods = ['weekly', 'monthly', 'quarterly', 'biweekly', 'biweek', 'week', 'month', 'quarter'];
    const normalizedPeriod = periodType && supportedPeriods.includes(String(periodType).toLowerCase())
      ? (periodType === 'week' ? 'weekly' : periodType === 'month' ? 'monthly' : periodType === 'quarter' ? 'quarterly' : periodType === 'biweek' ? 'biweekly' : periodType)
      : null;

    if (normalizedPeriod) {
      const pl = await profitabilityService.calculateProfitLoss(tenantId, normalizedPeriod);
      const priorityAction = profitabilityService.getPriorityAction(pl);
      const period = pl.period;
      const foodCostPct = pl.foodCostPercent ?? 0;
      const wastePct = pl.wastePercent ?? 0;
      const primePct = pl.primeCostPercent ?? 0;
      const purchasesAmount = pl.breakdown?.purchases?.amount ?? 0;
      const periodDifference = purchasesAmount - (pl.sales * (pl.targetFoodCostPercent / 100));
      let savingsBreakdown = null;
      let lossByCategory = [];
      try {
        savingsBreakdown = await this.getSavingsBreakdown(tenantId, period.startDate, period.endDate, periodDifference, period.label, pl);
        // Unify "Actual loss" with gross P&L: one number everywhere (Sales − Food − Labor − Waste)
        if (savingsBreakdown) {
          savingsBreakdown.totalPotentialSavings = !pl.isProfitable ? Math.abs(pl.grossProfit) : 0;
          savingsBreakdown.isLoss = !pl.isProfitable;
        }
        if (savingsBreakdown && savingsBreakdown.items && savingsBreakdown.items.length > 0) {
          const byCat = {};
          savingsBreakdown.items.forEach(it => {
            const c = (it.category || 'Other').trim();
            if (!byCat[c]) byCat[c] = 0;
            byCat[c] += Math.abs(it.monthlyImpact || it.currentCost || 0);
          });
          lossByCategory = Object.entries(byCat).map(([name, value]) => ({ name, value: parseFloat(value.toFixed(2)) }));
        }
      } catch (err) {
        console.error('Period savings breakdown failed:', err);
        // Ensure savingsBreakdown is always an object, not null
        if (!savingsBreakdown) {
          savingsBreakdown = {
            totalPotentialSavings: !pl.isProfitable ? Math.abs(pl.grossProfit) : 0,
            isLoss: !pl.isProfitable,
            calculation: { isLoss: !pl.isProfitable, difference: periodDifference, label: period.label },
            items: [],
            summary: { wasteIssues: 0, foodCostIssues: 0, varianceIssues: 0, inventoryIssues: 0 }
          };
        }
      }
      return {
        ...pl,
        priorityAction,
        periodInfo: {
          weekStart: period.startDate,
          weekEnd: period.endDate,
          monthStart: period.startDate,
          monthEnd: period.endDate,
          weekDayCount: period.dayCount,
          monthDayCount: period.dayCount,
          weekPeriodLabel: period.label,
          monthPeriodLabel: period.label
        },
        dailyBurnRate: pl.dailyBurnRate,
        foodCostPercentage: foodCostPct,
        foodCostPercent: foodCostPct,
        primeCost: primePct,
        primeCostPercent: primePct,
        wastePercentage: wastePct,
        wasteCost: pl.breakdown?.waste?.amount ?? 0,
        weeklySales: pl.sales,
        monthlySales: pl.sales,
        weeklyLoss: pl.isProfitable ? 0 : Math.abs(pl.grossProfit),
        monthlyLoss: pl.isProfitable ? 0 : Math.abs(pl.grossProfit),
        weeklyLossDisplay: { value: pl.isProfitable ? 0 : Math.abs(pl.grossProfit), isLoss: !pl.isProfitable, label: period.label },
        monthlyLossDisplay: { value: pl.isProfitable ? 0 : Math.abs(pl.grossProfit), isLoss: !pl.isProfitable, label: period.label },
        weeklyIsLoss: !pl.isProfitable,
        monthlyIsLoss: !pl.isProfitable,
        ifFixedMonthlySavings: !pl.isProfitable ? Math.abs(pl.grossProfit) : 0,
        savings: !pl.isProfitable ? Math.abs(pl.grossProfit) : 0,
        lossSummary: {
          theoreticalCost: pl.sales * (pl.targetFoodCostPercent / 100),
          actualCost: purchasesAmount,
          lossAmount: pl.isProfitable ? 0 : Math.abs(pl.grossProfit),
          lossPercent: pl.sales > 0 && !pl.isProfitable ? (Math.abs(pl.grossProfit) / pl.sales) * 100 : 0
        },
        foodCostDisplay: { value: foodCostPct, confidence: 'medium', message: foodCostPct.toFixed(1) + '%', tooltip: 'Food cost % of sales. Target 28%.' },
        wasteDisplay: {
          value: pl.wastePercentOfFoodCost ?? wastePct,
          valueOfSales: wastePct,
          confidence: 'medium',
          message: (pl.wastePercentOfFoodCost != null ? pl.wastePercentOfFoodCost.toFixed(0) + '% of food cost' : wastePct.toFixed(1) + '% of sales'),
          tooltip: pl.wastePercentOfFoodCost != null
            ? `Waste is ${pl.wastePercentOfFoodCost.toFixed(0)}% of food purchases (target <5%). Also ${wastePct.toFixed(1)}% of sales.`
            : 'Waste as % of sales. Target: under 5% of food cost.'
        },
        primeCostDisplay: { value: primePct, confidence: 'medium', message: primePct.toFixed(1) + '%', tooltip: 'Food + Labor %. Target 55–65%.', isCritical: primePct > 100 },
        laborCostPercentage: pl.laborCostPercent ?? pl.breakdown?.labor?.percent ?? 32.8,
        costs: pl.costs,
        wastePercentOfFoodCost: pl.wastePercentOfFoodCost,
        targetWastePercentOfFoodCost: pl.targetWastePercentOfFoodCost,
        lossDefinitions: {},
        savingsBreakdown: savingsBreakdown || {
          totalPotentialSavings: !pl.isProfitable ? Math.abs(pl.grossProfit) : 0,
          isLoss: !pl.isProfitable,
          calculation: { isLoss: !pl.isProfitable, difference: periodDifference, label: period.label },
          items: [],
          summary: { wasteIssues: 0, foodCostIssues: 0, varianceIssues: 0, inventoryIssues: 0 }
        },
        lossByCategory,
        biggestLossSource: lossByCategory.length > 0 ? { category: lossByCategory[0].name, total_waste: lossByCategory[0].value } : null,
        savingsDisplay: pl.isProfitable ? { value: 0, label: 'Under Target — No Loss to Fix', tooltip: 'On track this period.', actionLabel: null } : { value: Math.abs(pl.grossProfit), label: 'Actual Loss This Period', tooltip: 'Loss for ' + period.label, actionLabel: 'Fix Losses →' }
      };
    }

    const today = format(new Date(), 'yyyy-MM-dd');
    const weekStart = format(startOfWeek(new Date()), 'yyyy-MM-dd');
    const weekEnd = format(endOfWeek(new Date()), 'yyyy-MM-dd');
    const monthStart = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd');

    const cacheKey = `dashboard_metrics:${tenantId}:${monthStart}`;
    if (featureFlags.isEnabled('ENABLE_PERFORMANCE_CACHE')) {
      const cached = cacheService.get(cacheKey);
      if (cached) {
        if (metricsCollector && typeof metricsCollector.recordCacheHit === 'function') metricsCollector.recordCacheHit();
        return cached;
      }
      if (metricsCollector && typeof metricsCollector.recordCacheMiss === 'function') metricsCollector.recordCacheMiss();
    }

    // Weekly / Monthly: difference = actual purchases − (sales × 28% food-cost target).
    // Positive = over target = loss; negative = under target = gain.
    // Industry standard: 28% for full-service restaurants (target margin 72%)
    const TARGET_FOOD_COST = 0.28;
    const weeklyFoodCost = await this.calculateFoodCost(tenantId, weekStart, weekEnd);
    const weeklyDifference = weeklyFoodCost.totalPurchases - (weeklyFoodCost.totalSales * TARGET_FOOD_COST);

    const monthlyFoodCost = await this.calculateFoodCost(tenantId, monthStart, today);
    const monthlyDifference = monthlyFoodCost.totalPurchases - (monthlyFoodCost.totalSales * TARGET_FOOD_COST);

    // Waste percentage - calculate both weekly and monthly; fallback to last 30 days so recent waste (e.g. Jan 25) is included when "this month" is only 2 days
    const weeklyWaste = await db.getAsync(`
      SELECT SUM(cost_value) as total_waste
      FROM waste
      WHERE tenant_id = ? AND waste_date BETWEEN ? AND ?
    `, [tenantId, weekStart, weekEnd]);

    const monthlyWaste = await db.getAsync(`
      SELECT SUM(cost_value) as total_waste
      FROM waste
      WHERE tenant_id = ? AND waste_date BETWEEN ? AND ?
    `, [tenantId, monthStart, today]);

    const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd');
    const wasteLast30 = await db.getAsync(`
      SELECT SUM(cost_value) as total_waste FROM waste
      WHERE tenant_id = ? AND waste_date BETWEEN ? AND ?
    `, [tenantId, thirtyDaysAgo, today]);
    const purchasesLast30 = await db.getAsync(`
      SELECT COALESCE(SUM(total_amount), 0) as total FROM purchases
      WHERE tenant_id = ? AND purchase_date BETWEEN ? AND ?
    `, [tenantId, thirtyDaysAgo, today]);
    const salesLast30 = await db.getAsync(`
      SELECT COALESCE(SUM(total_sales), 0) as total FROM sales
      WHERE tenant_id = ? AND report_date BETWEEN ? AND ?
    `, [tenantId, thirtyDaysAgo, today]);

    // Waste % = Waste $ ÷ Sales $ × 100 (industry standard: waste as % of revenue)
    const wastePercentageMonthly = (monthlyFoodCost.totalSales || 0) > 0
      ? ((monthlyWaste?.total_waste || 0) / monthlyFoodCost.totalSales) * 100
      : 0;

    const wastePercentageWeekly = (weeklyFoodCost.totalSales || 0) > 0
      ? ((weeklyWaste?.total_waste || 0) / weeklyFoodCost.totalSales) * 100
      : 0;

    // Fallback: last 30 days waste % = waste ÷ sales
    const wastePctLast30 = (salesLast30?.total || 0) > 0
      ? ((wasteLast30?.total_waste || 0) / salesLast30.total) * 100
      : 0;
    const wastePercentage = wastePercentageMonthly > 0
      ? wastePercentageMonthly
      : wastePercentageWeekly > 0
        ? wastePercentageWeekly
        : (wasteLast30?.total_waste || 0) > 0
          ? wastePctLast30
          : 0;

    // Biggest loss source
    const wasteByCategory = await db.allAsync(`
      SELECT 
        pi.category,
        SUM(w.cost_value) as total_waste
      FROM waste w
      JOIN purchase_items pi ON w.item_name = pi.item_name AND w.tenant_id = pi.tenant_id
      WHERE w.tenant_id = ? AND w.waste_date BETWEEN ? AND ?
      GROUP BY pi.category
      ORDER BY total_waste DESC
      LIMIT 1
    `, [tenantId, monthStart, today]);

    // Period loss = food cost overrun + waste (so "Actual loss" includes both)
    const monthlyWasteTotalForLoss = monthlyWaste?.total_waste || 0;
    const monthlyIsLoss = monthlyDifference > 0 || monthlyWasteTotalForLoss > 0;
    const ifFixedMonthlySavings = (monthlyDifference > 0 ? monthlyDifference : 0) + monthlyWasteTotalForLoss;

    const monthDayCountForBreakdown = differenceInDays(new Date(today), new Date(monthStart)) + 1;
    const monthPeriodLabelForBreakdown = monthDayCountForBreakdown >= 28 ? 'This Month' : (monthDayCountForBreakdown === 1 ? 'Today' : `Last ${monthDayCountForBreakdown} Days`);
    let savingsBreakdown = null;
    try {
      savingsBreakdown = await this.getSavingsBreakdown(tenantId, monthStart, today, monthlyDifference, monthPeriodLabelForBreakdown);
    } catch (error) {
      console.error('Error generating savings breakdown:', error);
      const fallbackLabel = monthlyIsLoss ? `Loss (${monthPeriodLabelForBreakdown})` : `Gain (${monthPeriodLabelForBreakdown})`;
      savingsBreakdown = {
        totalPotentialSavings: ifFixedMonthlySavings,
        calculation: { isLoss: monthlyIsLoss, difference: monthlyDifference, label: fallbackLabel },
        items: [],
        summary: { wasteIssues: 0, foodCostIssues: 0, varianceIssues: 0, inventoryIssues: 0 }
      };
    }

    const laborCostPercentage = 32.8; // TODO: Calculate from labor data
    const foodCostPercentage = parseFloat(weeklyFoodCost.foodCost.toFixed(2));
    const primeCost = foodCostPercentage + laborCostPercentage; // Food % + Labor %; target 55–65%

    const monthlyWasteTotal = monthlyWaste?.total_waste || 0;
    const weeklyWasteTotalForLossNum = weeklyWaste?.total_waste || 0;
    const monthlyLossWithWasteNum = Math.abs(monthlyDifference) + monthlyWasteTotal;
    const weeklyLossWithWasteNum = Math.abs(weeklyDifference) + weeklyWasteTotalForLossNum;
    const theoreticalCost = monthlyFoodCost.totalSales * TARGET_FOOD_COST;
    const lossSummary = {
      theoreticalCost: parseFloat(theoreticalCost.toFixed(2)),
      actualCost: parseFloat(monthlyFoodCost.totalPurchases.toFixed(2)),
      lossAmount: parseFloat(monthlyLossWithWasteNum.toFixed(2)),
      lossPercent: theoreticalCost > 0
        ? parseFloat((monthlyLossWithWasteNum / theoreticalCost * 100).toFixed(1))
        : 0
    };
    const foodCostDisplay = this.getFoodCostDisplay(
      weeklyFoodCost,
      monthlyWasteTotal,
      weeklyFoodCost.totalSales || monthlyFoodCost.totalSales
    );
    let wasteDisplay = this.getWasteDisplay(
      monthlyWasteTotal,
      monthlyFoodCost.totalPurchases,
      monthlyFoodCost.totalSales
    );
    if (wastePercentage > 0 && wasteDisplay.value === 0 && (wasteLast30?.total_waste || 0) > 0) {
      wasteDisplay = {
        value: parseFloat(wastePercentage.toFixed(2)),
        confidence: 'medium',
        message: `${wastePercentage.toFixed(1)}%`,
        tooltip: `Waste % (last 30 days). Current month has limited purchase data; recent waste (e.g. $${(wasteLast30?.total_waste || 0).toLocaleString()}) is included.`
      };
    }

    const foodForPrime = foodCostDisplay.value ?? (foodCostDisplay.confidence !== 'none' ? foodCostPercentage : null);
    const primeCostNumRaw = foodForPrime != null ? foodForPrime + laborCostPercentage : null;
    const primeCostOver100 = primeCostNumRaw != null && primeCostNumRaw > 100;
    const primeCostDisplay = {
      value: primeCostNumRaw != null ? parseFloat(primeCostNumRaw.toFixed(2)) : null,
      confidence: foodCostDisplay.confidence,
      message: foodForPrime != null ? `${(foodForPrime + laborCostPercentage).toFixed(1)}%` : 'Add data',
      tooltip: foodForPrime != null
        ? `Food ${foodForPrime.toFixed(1)}% + Labor ${laborCostPercentage}%. Target 55–65%.`
        : 'Add purchase/inventory data to calculate Prime Cost.',
      isCritical: primeCostOver100
    };

    // Period labels: only call it "Weekly"/"Monthly" when data covers full period
    const weekDayCount = differenceInDays(new Date(weekEnd), new Date(weekStart)) + 1;
    const monthDayCount = differenceInDays(new Date(today), new Date(monthStart)) + 1;
    const weekPeriodLabel = weekDayCount >= 7 ? 'This Week' : (weekDayCount === 1 ? 'Today' : `Last ${weekDayCount} Days`);
    const monthPeriodLabel = monthDayCount >= 28 ? 'This Month' : (monthDayCount === 1 ? 'Today' : `Last ${monthDayCount} Days`);
    const periodInfo = {
      weekStart,
      weekEnd,
      weekDayCount,
      weekPeriodLabel,
      monthStart,
      monthEnd: today,
      monthDayCount,
      monthPeriodLabel
    };

    const weeklyIsLoss = weeklyDifference > 0 || weeklyWasteTotalForLossNum > 0;
    const lossDefinitions = {
      weeklyLoss: `Actual purchases vs 28% food-cost target (${weekPeriodLabel}). Over = loss, under = gain.`,
      monthlyLoss: `Actual purchases vs 28% food-cost target (${monthPeriodLabel}). Over = loss, under = gain.`,
      topLossSourcesNote: `Top 5 loss categories by dollar impact (${monthPeriodLabel}); may span waste, labor, supplier, shrinkage, menu.`
    };

    const weeklyLossDisplay = {
      value: parseFloat(weeklyLossWithWasteNum.toFixed(2)),
      isLoss: weeklyIsLoss,
      label: weeklyIsLoss ? (weekDayCount >= 7 ? 'Weekly Loss' : `Loss (${weekPeriodLabel})`) : (weekDayCount >= 7 ? 'Weekly Gain' : `Gain (${weekPeriodLabel})`)
    };
    const monthlyLossDisplay = {
      value: parseFloat(monthlyLossWithWasteNum.toFixed(2)),
      isLoss: monthlyIsLoss,
      label: monthlyIsLoss ? (monthDayCount >= 28 ? 'Monthly Loss' : `Loss (${monthPeriodLabel})`) : (monthDayCount >= 28 ? 'Monthly Gain' : `Gain (${monthPeriodLabel})`)
    };

    // Clarify: displayed amount is actual loss for the period; "potential savings" = estimate if issues are fixed going forward
    const savingsDisplay = monthlyIsLoss
      ? {
          value: parseFloat(ifFixedMonthlySavings.toFixed(2)),
          label: 'Actual Loss This Period',
          tooltip: `This is the actual loss for ${monthPeriodLabel}. Potential savings = estimate of what could be saved in future by fixing these issues.`,
          actionLabel: 'Fix Losses →'
        }
      : {
          value: 0,
          label: 'Under Target — No Loss to Fix',
          tooltip: 'Actual food spend is under target this period. No preventable loss; keep up current practices.',
          actionLabel: null
        };

    const primeCostNum = parseFloat(primeCost.toFixed(2));
    const savingsNum = parseFloat(ifFixedMonthlySavings.toFixed(2));
    const weeklyLossValue = parseFloat(weeklyLossWithWasteNum.toFixed(2));
    const monthlyLossValue = parseFloat(monthlyLossWithWasteNum.toFixed(2));

    // Revenue (sales) for cards and charts
    const weeklySales = weeklyFoodCost.totalSales || 0;
    const monthlySales = monthlyFoodCost.totalSales || 0;
    const dailySalesWeek = await db.allAsync(`
      SELECT report_date as date, COALESCE(SUM(total_sales), 0) as total
      FROM sales WHERE tenant_id = ? AND report_date BETWEEN ? AND ?
      GROUP BY report_date ORDER BY report_date
    `, [tenantId, weekStart, weekEnd]);
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const byDayOfWeek = [0, 0, 0, 0, 0, 0, 0];
    (dailySalesWeek || []).forEach(r => {
      const d = new Date(r.date + 'T12:00:00');
      byDayOfWeek[d.getDay()] += Number(r.total) || 0;
    });
    const weeklySalesByDay = dayNames.map((name, i) => ({ dayName: name, total: parseFloat(byDayOfWeek[i].toFixed(2)) }));

    // Loss by category for chart (sync with Top 5 Loss Sources)
    let lossByCategory = [];
    if (savingsBreakdown && savingsBreakdown.items && savingsBreakdown.items.length > 0) {
      const byCat = {};
      savingsBreakdown.items.forEach(it => {
        const c = (it.category || 'Other').trim();
        if (!byCat[c]) byCat[c] = 0;
        byCat[c] += Math.abs(it.monthlyImpact || it.currentCost || 0);
      });
      lossByCategory = Object.entries(byCat).map(([name, value]) => ({ name, value: parseFloat(value.toFixed(2)) }));
    }

    // Daily Burn Rate: period loss ÷ days in period (when loss); 0 when gain
    const dailyBurnRateValue = monthDayCount > 0 && monthlyIsLoss
      ? parseFloat((monthlyLossWithWasteNum / monthDayCount).toFixed(2))
      : 0;
    const dailyBurnRate = {
      value: dailyBurnRateValue,
      periodDays: monthDayCount,
      label: dailyBurnRateValue > 0 ? 'Daily Burn Rate' : 'No burn (on track)',
      tooltip: dailyBurnRateValue > 0
        ? `Average daily loss for ${monthPeriodLabel} ($${monthlyLossWithWasteNum.toFixed(2)} ÷ ${monthDayCount} days)`
        : 'No loss this period; burn rate is $0.'
    };

    const result = {
      weeklyLoss: weeklyLossValue,
      monthlyLoss: monthlyLossValue,
      dailyBurnRate,
      weeklyIsLoss,
      monthlyIsLoss,
      weeklyLossDisplay,
      monthlyLossDisplay,
      foodCostPercentage,
      laborCostPercentage,
      primeCost: primeCostNum,
      wastePercentage: parseFloat(wastePercentage.toFixed(2)),
      biggestLossSource: wasteByCategory[0] || null,
      ifFixedMonthlySavings: savingsNum,
      savingsBreakdown,
      foodCostDisplay,
      wasteDisplay,
      primeCostDisplay,
      lossDefinitions,
      savingsDisplay,
      foodCostPercent: foodCostPercentage,
      primeCostPercent: primeCostNum,
      wasteCost: parseFloat((monthlyWasteTotal || 0).toFixed(2)),
      savings: savingsNum,
      lossSummary,
      periodInfo,
      weeklySales: parseFloat(weeklySales.toFixed(2)),
      monthlySales: parseFloat(monthlySales.toFixed(2)),
      weeklySalesByDay,
      lossByCategory
    };
    if (featureFlags.isEnabled('ENABLE_PERFORMANCE_CACHE')) {
      const ttl = featureFlags.get('CACHE_TTL_DASHBOARD', 300000);
      cacheService.set(cacheKey, result, ttl);
    }
    return result;
  }

  /**
   * Get detailed breakdown of what needs to be fixed to achieve monthly savings.
   * When pl (profit/loss from profitabilityService) is provided, calculation shows true P&L:
   * Sales − (Food + Labor + Waste) = Gross Profit/Loss (one number everywhere).
   * @param {string} [periodLabel] - e.g. "Last 2 Days", "This Month" for calculation label
   * @param {Object} [pl] - optional period P&L from profitabilityService.calculateProfitLoss (sales, totalCost, grossProfit, costs, etc.)
   */
  async getSavingsBreakdown(tenantId, startDate, endDate, monthlyDifference, periodLabel, pl) {
    const foodCostData = await this.calculateFoodCost(tenantId, startDate, endDate);
    
    // Get detailed purchase breakdown
    const purchases = await db.allAsync(`
      SELECT 
        id,
        vendor,
        purchase_date,
        total_amount,
        invoice_number
      FROM purchases
      WHERE tenant_id = ? AND purchase_date BETWEEN ? AND ?
      ORDER BY purchase_date DESC
    `, [tenantId, startDate, endDate]);
    
    // Get detailed sales breakdown
    const sales = await db.allAsync(`
      SELECT 
        id,
        report_date,
        total_sales
      FROM sales
      WHERE tenant_id = ? AND report_date BETWEEN ? AND ?
      ORDER BY report_date DESC
    `, [tenantId, startDate, endDate]);
    
    const totalSales = pl ? pl.sales : (foodCostData.totalSales || 0);
    const totalPurchases = foodCostData.totalPurchases || 0;
    const totalLabor = pl ? (pl.costs?.labor ?? (totalSales * 0.328)) : (totalSales * 0.328);
    const totalWaste = pl ? (pl.costs?.waste ?? 0) : 0;
    const totalCosts = pl ? (pl.totalCost ?? (totalPurchases + totalLabor + totalWaste)) : (totalPurchases + totalLabor + totalWaste);
    const grossProfitLoss = pl ? (pl.grossProfit ?? (totalSales - totalCosts)) : (totalSales - totalCosts);
    const isLoss = grossProfitLoss < 0;
    const periodLabelSafe = periodLabel && String(periodLabel).trim();
    const foodCostPct = totalSales > 0 ? (totalPurchases / totalSales) * 100 : 0;
    const laborCostPct = totalSales > 0 ? (totalLabor / totalSales) * 100 : 0;
    const wastePctOfFood = totalPurchases > 0 ? (totalWaste / totalPurchases) * 100 : 0;

    // When pl is provided, use true P&L calculation (6 steps). Otherwise keep legacy food-variance style for non-dashboard callers.
    const stepByStep = pl
      ? [
          { step: 1, title: 'Total Sales', value: totalSales, description: `Sum of all sales from ${startDate} to ${endDate}`, source: 'sales table', count: sales.length },
          {
            step: 2,
            title: 'Total Costs',
            value: totalCosts,
            description: 'Food + Labor + Waste',
            formula: `Food $${totalPurchases.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} + Labor $${totalLabor.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} + Waste $${totalWaste.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} = $${totalCosts.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          },
          {
            step: 3,
            title: 'Gross Profit / Loss',
            value: grossProfitLoss,
            description: isLoss ? 'Sales − Costs = negative = loss.' : 'Sales − Costs = profit.',
            formula: `$${totalSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} − $${totalCosts.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} = ${grossProfitLoss < 0 ? '-' : ''}$${Math.abs(grossProfitLoss).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            isLoss
          },
          { step: 4, title: 'Food Cost %', value: foodCostPct, description: 'Food ÷ Sales', formula: `$${totalPurchases.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ÷ $${totalSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} = ${foodCostPct.toFixed(1)}%` },
          { step: 5, title: 'Labor Cost %', value: laborCostPct, description: 'Labor ÷ Sales', formula: `$${totalLabor.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ÷ $${totalSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} = ${laborCostPct.toFixed(1)}%` },
          { step: 6, title: 'Waste % of Food Cost', value: wastePctOfFood, description: 'Waste ÷ Food (target &lt; 5%)', formula: `$${totalWaste.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ÷ $${totalPurchases.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} = ${wastePctOfFood.toFixed(0)}%` }
        ]
      : (() => {
          const TARGET = 0.28;
          const expectedPurchases = (foodCostData.totalSales || 0) * TARGET;
          const difference = totalPurchases - expectedPurchases;
          const foodVarianceLoss = difference > 0;
          const absDiff = Math.abs(difference);
          const label = foodVarianceLoss ? (periodLabelSafe ? `Food cost over target (${periodLabelSafe})` : 'Food cost over target') : (periodLabelSafe ? `Under target (${periodLabelSafe})` : 'Under target');
          return [
            { step: 1, title: 'Total Sales', value: foodCostData.totalSales || 0, description: `Sum of all sales from ${startDate} to ${endDate}`, source: 'sales table', count: sales.length },
            { step: 2, title: 'Target Food Cost (28%)', value: expectedPurchases, description: 'Expected purchases = Sales × 28%', formula: `$${(foodCostData.totalSales || 0).toLocaleString()} × 0.28 = $${expectedPurchases.toLocaleString()}` },
            { step: 3, title: 'Actual Purchases', value: totalPurchases, description: `Sum of all purchases from ${startDate} to ${endDate}`, source: 'purchases table', count: purchases.length },
            { step: 4, title: label, value: absDiff, description: foodVarianceLoss ? 'Actual > target → over-spend.' : 'Under target (gain).', formula: `$${totalPurchases.toLocaleString()} − $${expectedPurchases.toLocaleString()} = $${difference.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, isLoss: foodVarianceLoss }
          ];
        })();

    const breakdown = {
      totalPotentialSavings: isLoss ? Math.abs(grossProfitLoss) : 0,
      isLoss,
      items: [],
      summary: {
        wasteIssues: 0,
        foodCostIssues: 0,
        varianceIssues: 0,
        inventoryIssues: 0
      },
      calculation: {
        totalPurchases,
        totalSales,
        totalLabor: parseFloat(totalLabor.toFixed(2)),
        totalWaste: parseFloat(totalWaste.toFixed(2)),
        totalCosts: parseFloat(totalCosts.toFixed(2)),
        grossProfitLoss: parseFloat(grossProfitLoss.toFixed(2)),
        foodCostPercent: parseFloat(foodCostPct.toFixed(2)),
        laborCostPercent: parseFloat(laborCostPct.toFixed(2)),
        wastePercentOfFoodCost: parseFloat(wastePctOfFood.toFixed(2)),
        isLoss,
        label: periodLabelSafe ? (isLoss ? `Loss (${periodLabelSafe})` : `Profit (${periodLabelSafe})`) : (isLoss ? 'Loss' : 'Profit'),
        explanation: pl ? 'Gross P&L = Sales − (Food + Labor + Waste). One number everywhere.' : 'Food cost variance = Actual purchases − Target (28% of sales).',
        stepByStep,
        purchases: purchases.map(p => ({
          date: p.purchase_date,
          vendor: p.vendor || 'Unknown',
          amount: p.total_amount,
          invoice: p.invoice_number || 'N/A'
        })),
        sales: sales.map(s => ({
          date: s.report_date,
          amount: s.total_sales,
          source: 'Manual'
        }))
      }
    };

    // 1. Waste Issues Breakdown
    const monthlyWaste = await db.getAsync(`
      SELECT SUM(cost_value) as total_waste
      FROM waste
      WHERE tenant_id = ? AND waste_date BETWEEN ? AND ?
    `, [tenantId, startDate, endDate]);
    const wasteAmount = monthlyWaste?.total_waste || 0;

    if (wasteAmount > 0) {
      // Get waste by category: one category per waste row to avoid double-counting when
      // one waste record joins to multiple purchase_items rows (e.g. same item, different category/NULL)
      const wasteByCategory = await db.allAsync(`
        SELECT 
          category,
          SUM(cost_value) as total_waste,
          COUNT(*) as item_count
        FROM (
          SELECT 
            w.cost_value,
            COALESCE(
              (SELECT MIN(pi.category) FROM purchase_items pi 
               WHERE pi.item_name = w.item_name AND pi.tenant_id = w.tenant_id AND pi.category IS NOT NULL AND pi.category != ''),
              'Unknown'
            ) as category
          FROM waste w
          WHERE w.tenant_id = ? AND w.waste_date BETWEEN ? AND ?
        ) sub
        GROUP BY category
        ORDER BY total_waste DESC
      `, [tenantId, startDate, endDate]);

      wasteByCategory.forEach(cat => {
        breakdown.items.push({
          id: `WASTE_${cat.category || 'UNKNOWN'}`,
          category: 'Waste',
          issue: `Excessive waste in ${cat.category || 'Unknown'} category`,
          currentCost: parseFloat(cat.total_waste.toFixed(2)),
          monthlyImpact: parseFloat(cat.total_waste.toFixed(2)),
          priority: cat.total_waste > 1000 ? 'High' : cat.total_waste > 500 ? 'Medium' : 'Low',
          recommendation: `Reduce waste in ${cat.category || 'Unknown'} category. Review ${cat.item_count} items and improve inventory rotation.`,
          actionItems: [
            'Implement FIFO (First In, First Out) inventory rotation',
            'Train staff on proper storage and handling',
            'Review portion sizes and prep procedures',
            'Set up waste tracking alerts'
          ]
        });
      });
      breakdown.summary.wasteIssues = wasteByCategory.length;
    }

    // 2. Food Cost Issues (High food cost percentage)
    // Note: foodCostData already calculated at the beginning of the function
    const targetFoodCost = 28; // Industry standard
    const foodCostOver = foodCostData.foodCost > targetFoodCost;
    
    if (foodCostOver) {
      // Calculate excess cost
      const excessPercentage = foodCostData.foodCost - targetFoodCost;
      const excessCost = (foodCostData.totalSales * excessPercentage / 100);
      
      breakdown.items.push({
        id: 'FOOD_COST_HIGH',
        category: 'Food Cost',
        issue: `Food cost ${foodCostData.foodCost.toFixed(1)}% exceeds target of ${targetFoodCost}%`,
        currentCost: parseFloat(excessCost.toFixed(2)),
        monthlyImpact: parseFloat(excessCost.toFixed(2)),
        priority: excessPercentage > 5 ? 'High' : 'Medium',
        recommendation: `Reduce food cost by ${excessPercentage.toFixed(1)}% through better purchasing and pricing strategies.`,
        actionItems: [
          'Negotiate better prices with suppliers',
          'Review menu pricing to maintain margins',
          'Identify and replace high-cost items',
          'Optimize portion sizes',
          'Source alternative suppliers for expensive items'
        ]
      });
      breakdown.summary.foodCostIssues = 1;
    }

    // 3. Variance Issues (Purchases vs Sales mismatch)
    const varianceData = await this.detectVariance(tenantId, startDate, endDate);
    if (varianceData && varianceData.variances && varianceData.variances.length > 0) {
      const significantVariances = varianceData.variances.filter(v => Math.abs(v.varianceAmount) > 100);
      
      significantVariances.forEach(variance => {
        breakdown.items.push({
          id: `VARIANCE_${variance.itemName}`,
          category: 'Variance',
          issue: `Significant variance for ${variance.itemName}: ${variance.varianceAmount > 0 ? 'Over-purchased' : 'Under-accounted'}`,
          currentCost: parseFloat(Math.abs(variance.varianceAmount).toFixed(2)),
          monthlyImpact: parseFloat(Math.abs(variance.varianceAmount).toFixed(2)),
          priority: Math.abs(variance.varianceAmount) > 500 ? 'High' : 'Medium',
          recommendation: `Investigate variance for ${variance.itemName}. Check for theft, waste, or accounting errors.`,
          actionItems: [
            'Review inventory counts and reconcile',
            'Check for unrecorded waste or spoilage',
            'Verify sales data accuracy',
            'Implement tighter inventory controls'
          ]
        });
      });
      breakdown.summary.varianceIssues = significantVariances.length;
    }

    // Top Waste Items: not added as separate breakdown items to avoid double-counting
    // (waste is already included once in waste-by-category above)

    // Sort by $ impact (highest first) so e.g. Waste $700 is #1, then food cost, then labor
    breakdown.items.sort((a, b) => {
      const impactA = Math.abs(a.monthlyImpact ?? a.currentCost ?? 0);
      const impactB = Math.abs(b.monthlyImpact ?? b.currentCost ?? 0);
      return impactB - impactA;
    });

    const calculatedTotal = breakdown.items.reduce((sum, item) => sum + (item.monthlyImpact || 0), 0);
    if (!pl && breakdown.isLoss) {
      const expectedPurchasesLegacy = (foodCostData.totalSales || 0) * 0.28;
      const differenceLegacy = totalPurchases - expectedPurchasesLegacy;
      breakdown.totalPotentialSavings = calculatedTotal > 0 ? calculatedTotal : Math.max(0, differenceLegacy);
    } else if (!breakdown.isLoss) {
      breakdown.totalPotentialSavings = 0;
    }

    return breakdown;
  }

  /**
   * Calculate profit margins by product/item
   */
  async calculateProductMargins(tenantId, startDate, endDate) {
    // Get sales with items
    const salesItems = await db.allAsync(`
      SELECT 
        si.item_name,
        SUM(si.quantity) as total_sold,
        SUM(si.total_price) as total_revenue,
        AVG(si.unit_price) as avg_selling_price
      FROM sales_items si
      JOIN sales s ON si.sale_id = s.id
      WHERE s.tenant_id = ? AND si.tenant_id = ? AND s.report_date BETWEEN ? AND ?
      GROUP BY si.item_name
    `, [tenantId, tenantId, startDate, endDate]);

    // Get purchase costs
    const purchaseItems = await db.allAsync(`
      SELECT 
        pi.item_name,
        SUM(pi.quantity) as total_purchased,
        SUM(pi.total_price) as total_cost,
        AVG(pi.unit_price) as avg_cost_price
      FROM purchase_items pi
      JOIN purchases p ON pi.purchase_id = p.id
      WHERE p.tenant_id = ? AND pi.tenant_id = ? AND p.purchase_date BETWEEN ? AND ?
      GROUP BY pi.item_name
    `, [tenantId, tenantId, startDate, endDate]);

    // Create cost map
    const costMap = {};
    purchaseItems.forEach(p => {
      costMap[p.item_name.toLowerCase()] = p;
    });

    // Calculate margins
    const margins = salesItems.map(sale => {
      const itemKey = sale.item_name.toLowerCase();
      const cost = costMap[itemKey];
      
      const revenue = sale.total_revenue || 0;
      const costAmount = cost ? (cost.total_cost * (sale.total_sold / cost.total_purchased)) : 0;
      const profit = revenue - costAmount;
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
      const roi = costAmount > 0 ? (profit / costAmount) * 100 : 0;

      return {
        itemName: sale.item_name,
        unitsSold: sale.total_sold,
        revenue: parseFloat(revenue.toFixed(2)),
        cost: parseFloat(costAmount.toFixed(2)),
        profit: parseFloat(profit.toFixed(2)),
        marginPercentage: parseFloat(margin.toFixed(2)),
        roiPercentage: parseFloat(roi.toFixed(2)),
        avgSellingPrice: parseFloat(sale.avg_selling_price.toFixed(2)),
        avgCostPrice: cost ? parseFloat(cost.avg_cost_price.toFixed(2)) : 0
      };
    }).sort((a, b) => b.profit - a.profit);

    return {
      period: { startDate, endDate },
      items: margins,
      totalRevenue: margins.reduce((sum, m) => sum + m.revenue, 0),
      totalCost: margins.reduce((sum, m) => sum + m.cost, 0),
      totalProfit: margins.reduce((sum, m) => sum + m.profit, 0),
      averageMargin: margins.length > 0 
        ? margins.reduce((sum, m) => sum + m.marginPercentage, 0) / margins.length 
        : 0
    };
  }

  /**
   * Get trends analysis (week over week, month over month)
   */
  async getTrendsAnalysis(tenantId, periodType = 'weekly', weeks = 4) {
    const trends = [];
    const today = new Date();

    for (let i = weeks - 1; i >= 0; i--) {
      let startDate, endDate, label;

      if (periodType === 'weekly') {
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - (i * 7) - 6);
        const weekEnd = new Date(today);
        weekEnd.setDate(today.getDate() - (i * 7));
        startDate = format(weekStart, 'yyyy-MM-dd');
        endDate = format(weekEnd, 'yyyy-MM-dd');
        label = `Semana ${weeks - i}`;
      } else {
        const monthStart = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const monthEnd = new Date(today.getFullYear(), today.getMonth() - i + 1, 0);
        startDate = format(monthStart, 'yyyy-MM-dd');
        endDate = format(monthEnd, 'yyyy-MM-dd');
        label = format(monthStart, 'MMMM yyyy');
      }

      const foodCost = await this.calculateFoodCost(tenantId, startDate, endDate);
      const waste = await db.getAsync(`
        SELECT SUM(cost_value) as total_waste
        FROM waste
        WHERE tenant_id = ? AND waste_date BETWEEN ? AND ?
      `, [tenantId, startDate, endDate]);

      trends.push({
        period: label,
        startDate,
        endDate,
        sales: foodCost.totalSales,
        purchases: foodCost.totalPurchases,
        waste: waste?.total_waste || 0,
        foodCostPercentage: foodCost.foodCost,
        profit: foodCost.totalSales - foodCost.totalPurchases - (waste?.total_waste || 0)
      });
    }

    return {
      periodType,
      trends,
      growth: trends.length > 1 ? {
        salesGrowth: ((trends[trends.length - 1].sales - trends[0].sales) / trends[0].sales) * 100,
        profitGrowth: ((trends[trends.length - 1].profit - trends[0].profit) / Math.abs(trends[0].profit)) * 100
      } : null
    };
  }

  /**
   * Get supplier ranking by cost
   */
  async getSupplierRanking(tenantId, startDate, endDate) {
    const suppliers = await db.allAsync(`
      SELECT 
        p.vendor,
        COUNT(DISTINCT p.id) as invoice_count,
        SUM(p.total_amount) as total_spent,
        AVG(p.total_amount) as avg_invoice_amount,
        MIN(p.purchase_date) as first_purchase,
        MAX(p.purchase_date) as last_purchase
      FROM purchases p
      WHERE p.tenant_id = ? AND p.purchase_date BETWEEN ? AND ?
      GROUP BY p.vendor
      ORDER BY total_spent DESC
    `, [tenantId, startDate, endDate]);

    const totalSpent = suppliers.reduce((sum, s) => sum + s.total_spent, 0);

    return {
      period: { startDate, endDate },
      suppliers: suppliers.map(s => ({
        vendor: s.vendor,
        invoiceCount: s.invoice_count,
        totalSpent: parseFloat(s.total_spent.toFixed(2)),
        avgInvoiceAmount: parseFloat(s.avg_invoice_amount.toFixed(2)),
        percentageOfTotal: totalSpent > 0 ? parseFloat(((s.total_spent / totalSpent) * 100).toFixed(2)) : 0,
        firstPurchase: s.first_purchase,
        lastPurchase: s.last_purchase
      })),
      totalSpent: parseFloat(totalSpent.toFixed(2))
    };
  }

  /**
   * Compare performance between periods
   */
  async comparePeriods(tenantId, period1Start, period1End, period2Start, period2End) {
    const period1 = await this.calculateFoodCost(tenantId, period1Start, period1End);
    const period2 = await this.calculateFoodCost(tenantId, period2Start, period2End);

    const period1Waste = await db.getAsync(`
      SELECT SUM(cost_value) as total_waste
      FROM waste
      WHERE tenant_id = ? AND waste_date BETWEEN ? AND ?
    `, [tenantId, period1Start, period1End]);

    const period2Waste = await db.getAsync(`
      SELECT SUM(cost_value) as total_waste
      FROM waste
      WHERE tenant_id = ? AND waste_date BETWEEN ? AND ?
    `, [tenantId, period2Start, period2End]);

    const p1Sales = period1.totalSales || 0;
    const p1Purchases = period1.totalPurchases || 0;
    const p1Waste = period1Waste?.total_waste || 0;
    const p2Waste = period2Waste?.total_waste || 0;
    const period1Profit = p1Sales - p1Purchases - p1Waste;
    const period2Profit = (period2.totalSales || 0) - (period2.totalPurchases || 0) - p2Waste;

    const safePct = (delta, base) => (base && base !== 0) ? parseFloat(((delta / base) * 100).toFixed(2)) : 0;

    return {
      period1: {
        label: `${period1Start} to ${period1End}`,
        sales: p1Sales,
        purchases: p1Purchases,
        waste: p1Waste,
        profit: period1Profit,
        foodCostPercentage: period1.foodCost
      },
      period2: {
        label: `${period2Start} to ${period2End}`,
        sales: period2.totalSales || 0,
        purchases: period2.totalPurchases || 0,
        waste: p2Waste,
        profit: period2Profit,
        foodCostPercentage: period2.foodCost
      },
      comparison: {
        salesChange: safePct((period2.totalSales || 0) - p1Sales, p1Sales),
        purchasesChange: safePct((period2.totalPurchases || 0) - p1Purchases, p1Purchases),
        wasteChange: safePct(p2Waste - p1Waste, p1Waste),
        profitChange: safePct(period2Profit - period1Profit, Math.abs(period1Profit) || 1),
        foodCostChange: parseFloat((period2.foodCost - period1.foodCost).toFixed(2))
      }
    };
  }

  /** Delegate to wasteAnalysisService */
  async getExpiringItemsAlerts(tenantId, daysAhead = 7) {
    return wasteAnalysisService.getExpiringItemsAlerts(tenantId, daysAhead);
  }

  /**
   * Get action items requiring attention (uses same period as dashboard: month-to-date)
   */
  async getActionItems(tenantId) {
    const today = format(new Date(), 'yyyy-MM-dd');
    const monthStart = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd');
    // Use same period as dashboard so action item numbers match (e.g. Food cost 67.47%)
    const periodStart = monthStart;
    const periodEnd = today;

    // Get food cost for dashboard period
    const foodCost = await this.calculateFoodCost(tenantId, periodStart, periodEnd);
    const targetFoodCost = 28;
    const foodCostOver = foodCost.foodCost > targetFoodCost;

    // Get waste percentage for dashboard period: Waste $ ÷ Sales $ × 100
    const waste = await this.calculateWaste(tenantId, periodStart, periodEnd);
    const totalWaste = waste.reduce((sum, w) => sum + w.wasteCost, 0);
    const totalSales = foodCost.totalSales || 0;
    const wastePercentage = totalSales > 0 ? (totalWaste / totalSales) * 100 : 0;
    const targetWaste = 5;
    const wasteOver = wastePercentage > targetWaste;

    // Get labor cost (simulated - would need labor data table)
    const laborCostPercentage = 32.8; // This would come from a labor table
    const targetLaborCost = 30;
    const laborCostOver = laborCostPercentage > targetLaborCost;

    // Get low stock items
    const lowStockItems = await db.allAsync(`
      SELECT COUNT(*) as count FROM inventory 
      WHERE tenant_id = ? AND quantity < 10
    `, [tenantId]);
    const hasLowStock = (lowStockItems[0]?.count || 0) > 0;

    // Get expiring items
    const expiringItems = await this.getExpiringItemsAlerts(tenantId, 7);
    const hasExpiringItems = expiringItems.length > 0;

    const actionItems = [];

    if (foodCostOver) {
      actionItems.push({
        id: 'FOOD_COST_HIGH',
        priority: 'high',
        category: 'Food Cost',
        title: `Food cost ${foodCost.foodCost.toFixed(1)}% (target: ${targetFoodCost}%)`,
        description: `Food cost is ${(foodCost.foodCost - targetFoodCost).toFixed(1)}% over target`,
        impact: 'High',
        status: 'active',
        action: 'Review purchasing patterns and negotiate better supplier prices'
      });
    }

    if (wasteOver) {
      actionItems.push({
        id: 'WASTE_HIGH',
        priority: 'high',
        category: 'Waste',
        title: `Waste ${wastePercentage.toFixed(1)}% (target: ${targetWaste}%)`,
        description: `Waste is ${(wastePercentage - targetWaste).toFixed(1)}% over target`,
        impact: 'High',
        status: 'active',
        action: 'Review waste tracking and improve inventory management'
      });
    }

    if (laborCostOver) {
      actionItems.push({
        id: 'LABOR_COST_HIGH',
        priority: 'medium',
        category: 'Labor',
        title: `Labor cost ${laborCostPercentage.toFixed(1)}% (target: ${targetLaborCost}%)`,
        description: `Labor cost is ${(laborCostPercentage - targetLaborCost).toFixed(1)}% over target`,
        impact: 'Medium',
        status: 'active',
        action: 'Review staffing levels and optimize schedules'
      });
    }

    if (hasLowStock) {
      actionItems.push({
        id: 'LOW_STOCK',
        priority: 'medium',
        category: 'Inventory',
        title: 'Low stock items detected',
        description: `${lowStockItems[0]?.count || 0} items are running low`,
        impact: 'Medium',
        status: 'active',
        action: 'Review inventory and place orders for low stock items'
      });
    }

    if (hasExpiringItems) {
      actionItems.push({
        id: 'EXPIRING_ITEMS',
        priority: 'high',
        category: 'Inventory',
        title: `${expiringItems.length} items expiring soon`,
        description: `${expiringItems.length} items will expire within 7 days`,
        impact: 'High',
        status: 'active',
        action: 'Use or sell expiring items to prevent waste'
      });
    }

    return {
      items: actionItems,
      count: actionItems.length,
      highPriority: actionItems.filter(item => item.priority === 'high').length,
      mediumPriority: actionItems.filter(item => item.priority === 'medium').length
    };
  }

  /**
   * Calculate labor cost analysis
   */
  async calculateLaborCost(tenantId, startDate, endDate) {
    // This is a placeholder - would need a labor/hours table
    // For now, return simulated data based on sales
    const defaultEndDate = endDate || new Date().toISOString().split('T')[0];
    const defaultStartDate = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const sales = await db.getAsync(`
      SELECT SUM(total_sales) as total_sales
      FROM sales
      WHERE tenant_id = ? AND report_date BETWEEN ? AND ?
    `, [tenantId, defaultStartDate, defaultEndDate]);

    const totalSales = sales?.total_sales || 0;
    // Simulate labor cost as 32.8% of sales (would come from actual labor data)
    const laborCost = totalSales * 0.328;
    const targetLaborCost = totalSales * 0.30;
    const laborCostOver = laborCost - targetLaborCost;

    return {
      laborCost: parseFloat(laborCost.toFixed(2)),
      totalSales: parseFloat(totalSales.toFixed(2)),
      laborCostPercentage: 32.8,
      targetLaborCostPercentage: 30,
      overTarget: parseFloat(laborCostOver.toFixed(2)),
      period: { startDate: defaultStartDate, endDate: defaultEndDate }
    };
  }

  /**
   * Get menu profitability analysis
   */
  async getMenuProfitability(tenantId, startDate, endDate) {
    const defaultEndDate = endDate || new Date().toISOString().split('T')[0];
    const defaultStartDate = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Get sales by item
    const salesItems = await db.allAsync(`
      SELECT 
        si.item_name,
        SUM(si.quantity) as quantity_sold,
        SUM(si.total_price) as revenue,
        AVG(si.unit_price) as avg_price
      FROM sales_items si
      JOIN sales s ON si.sale_id = s.id
      WHERE s.tenant_id = ? AND si.tenant_id = ? AND s.report_date BETWEEN ? AND ?
      GROUP BY si.item_name
      ORDER BY revenue DESC
    `, [tenantId, tenantId, defaultStartDate, defaultEndDate]);

    // Get ingredient costs (would need recipe/BOM data)
    // For now, estimate cost as 60% of price (would come from actual recipe costs)
    const menuItems = salesItems.map(item => {
      const estimatedCost = item.revenue * 0.60;
      const profit = item.revenue - estimatedCost;
      const margin = item.revenue > 0 ? (profit / item.revenue) * 100 : 0;

      return {
        itemName: item.item_name,
        quantitySold: item.quantity_sold,
        revenue: parseFloat(item.revenue.toFixed(2)),
        estimatedCost: parseFloat(estimatedCost.toFixed(2)),
        profit: parseFloat(profit.toFixed(2)),
        margin: parseFloat(margin.toFixed(2)),
        avgPrice: parseFloat(item.avg_price.toFixed(2))
      };
    });

    const totalRevenue = menuItems.reduce((sum, item) => sum + item.revenue, 0);
    const totalCost = menuItems.reduce((sum, item) => sum + item.estimatedCost, 0);
    const totalProfit = totalRevenue - totalCost;
    const overallMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    return {
      items: menuItems,
      summary: {
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        totalCost: parseFloat(totalCost.toFixed(2)),
        totalProfit: parseFloat(totalProfit.toFixed(2)),
        overallMargin: parseFloat(overallMargin.toFixed(2)),
        itemCount: menuItems.length
      },
      period: { startDate: defaultStartDate, endDate: defaultEndDate }
    };
  }

  /**
   * Detect variance (price, quantity, etc.)
   */
  async detectVariance(tenantId, startDate, endDate) {
    const defaultEndDate = endDate || new Date().toISOString().split('T')[0];
    const defaultStartDate = startDate || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Get purchase items with price variance
    const purchases = await db.allAsync(`
      SELECT 
        pi.item_name,
        pi.unit_price,
        pi.quantity,
        pi.total_price,
        p.purchase_date,
        p.vendor
      FROM purchase_items pi
      JOIN purchases p ON pi.purchase_id = p.id
      WHERE p.tenant_id = ? AND pi.tenant_id = ? AND p.purchase_date BETWEEN ? AND ?
      ORDER BY pi.item_name, p.purchase_date
    `, [tenantId, tenantId, defaultStartDate, defaultEndDate]);

    // Group by item and detect price variance
    const itemMap = {};
    purchases.forEach(p => {
      const key = p.item_name.toLowerCase();
      if (!itemMap[key]) {
        itemMap[key] = {
          itemName: p.item_name,
          prices: [],
          vendors: []
        };
      }
      itemMap[key].prices.push(p.unit_price);
      itemMap[key].vendors.push({ vendor: p.vendor, price: p.unit_price, date: p.purchase_date });
    });

    const variances = [];
    Object.values(itemMap).forEach(item => {
      if (item.prices.length > 1) {
        const avgPrice = item.prices.reduce((sum, p) => sum + p, 0) / item.prices.length;
        const maxPrice = Math.max(...item.prices);
        const minPrice = Math.min(...item.prices);
        const variance = ((maxPrice - minPrice) / avgPrice) * 100;

        if (variance > 10) { // More than 10% variance
          variances.push({
            itemName: item.itemName,
            averagePrice: parseFloat(avgPrice.toFixed(2)),
            minPrice: parseFloat(minPrice.toFixed(2)),
            maxPrice: parseFloat(maxPrice.toFixed(2)),
            variancePercentage: parseFloat(variance.toFixed(2)),
            priceHistory: item.vendors,
            severity: variance > 20 ? 'high' : variance > 15 ? 'medium' : 'low'
          });
        }
      }
    });

    return {
      variances: variances.sort((a, b) => b.variancePercentage - a.variancePercentage),
      count: variances.length,
      highSeverity: variances.filter(v => v.severity === 'high').length,
      period: { startDate: defaultStartDate, endDate: defaultEndDate }
    };
  }

  /**
   * Get available reports
   */
  async getAvailableReports(tenantId) {
    return {
      reports: [
        {
          id: 'monthly-profit',
          name: 'Monthly Profit Report',
          description: 'POS-driven executive summary, profit leakage, action plan',
          category: 'Performance',
          available: true
        },
        {
          id: 'food-cost',
          name: 'Food Cost Report',
          description: 'Detailed food cost analysis',
          category: 'Cost Analysis',
          available: true
        },
        {
          id: 'waste',
          name: 'Waste Analysis Report',
          description: 'Waste tracking and analysis',
          category: 'Waste Management',
          available: true
        },
        {
          id: 'inventory',
          name: 'Inventory Report',
          description: 'Current inventory levels and trends',
          category: 'Inventory',
          available: true
        },
        {
          id: 'sales',
          name: 'Sales Report',
          description: 'Sales performance and trends',
          category: 'Sales',
          available: true
        },
        {
          id: 'profitability',
          name: 'Menu Profitability Report',
          description: 'Item-by-item profitability analysis',
          category: 'Menu Analysis',
          available: true
        },
        {
          id: 'variance',
          name: 'Variance Detection Report',
          description: 'Price and quantity variance analysis',
          category: 'Cost Control',
          available: true
        },
        {
          id: 'labor',
          name: 'Labor Cost Report',
          description: 'Labor cost analysis',
          category: 'Labor',
          available: true
        }
      ]
    };
  }

  /**
   * Export report data
   */
  async exportReport(tenantId, reportType, format = 'json', startDate, endDate) {
    const defaultEndDate = endDate || new Date().toISOString().split('T')[0];
    const defaultStartDate = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    let data = {};

    switch (reportType) {
      case 'food-cost':
        data = await this.calculateFoodCost(tenantId, defaultStartDate, defaultEndDate);
        break;
      case 'waste':
        data = await this.calculateWaste(tenantId, defaultStartDate, defaultEndDate);
        break;
      case 'profitability':
        data = await this.getMenuProfitability(tenantId, defaultStartDate, defaultEndDate);
        break;
      case 'variance':
        data = await this.detectVariance(tenantId, defaultStartDate, defaultEndDate);
        break;
      case 'labor':
        data = await this.calculateLaborCost(tenantId, defaultStartDate, defaultEndDate);
        break;
      default:
        data = { error: 'Unknown report type' };
    }

    return {
      reportType,
      format,
      data,
      exportedAt: new Date().toISOString(),
      period: { startDate: defaultStartDate, endDate: defaultEndDate }
    };
  }

  /**
   * Get all alerts (expiring items, low stock, etc.)
   */
  async getAllAlerts(tenantId) {
    const expiringItems = await this.getExpiringItemsAlerts(tenantId, 7);
    const lowStockItems = await db.allAsync(`
      SELECT 
        item_name,
        quantity,
        category,
        unit_price
      FROM inventory
      WHERE tenant_id = ? AND quantity < 10 AND quantity > 0
      ORDER BY quantity ASC
    `, [tenantId]);

    const alerts = [];

    // Expiring items alerts
    expiringItems.forEach(item => {
      alerts.push({
        id: `EXP_${item.itemName}`,
        type: 'expiring',
        severity: item.isExpired ? 'critical' : item.daysUntilExpiry <= 2 ? 'high' : 'medium',
        title: `${item.itemName} expiring soon`,
        message: item.isExpired 
          ? `${item.itemName} has expired`
          : `${item.itemName} will expire in ${item.daysUntilExpiry} days`,
        itemName: item.itemName,
        category: item.category,
        quantity: item.quantity,
        expiryDate: item.expiryDate,
        daysUntilExpiry: item.daysUntilExpiry
      });
    });

    // Low stock alerts
    lowStockItems.forEach(item => {
      alerts.push({
        id: `LOW_${item.item_name}`,
        type: 'low_stock',
        severity: item.quantity < 5 ? 'high' : 'medium',
        title: `${item.item_name} running low`,
        message: `${item.item_name} has only ${item.quantity} units remaining`,
        itemName: item.item_name,
        category: item.category,
        quantity: item.quantity,
        unitPrice: item.unit_price
      });
    });

    return {
      alerts: alerts.sort((a, b) => {
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      }),
      count: alerts.length,
      critical: alerts.filter(a => a.severity === 'critical').length,
      high: alerts.filter(a => a.severity === 'high').length,
      medium: alerts.filter(a => a.severity === 'medium').length
    };
  }
}

module.exports = new AnalyticsService();
