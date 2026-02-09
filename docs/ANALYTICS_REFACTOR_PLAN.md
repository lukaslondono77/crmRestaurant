# Analytics Service Refactoring Plan (Cloudignite)

This document defines a detailed technical refactoring plan for the monolithic `backend/src/services/analyticsService.js` (~1,484 lines) into focused, testable modules.

---

## 1. Proposed New Modules

| Module | Responsibility | Est. Lines |
|--------|----------------|------------|
| **dashboardMetricsService.js** | Dashboard KPIs: food cost, waste %, prime cost, period loss/gain, sales by day, loss by category, period labels, display helpers (getFoodCostDisplay, getWasteDisplay). | ~350 |
| **actionItemService.js** | Single source for action items: priority algorithm, one “Priority 1 Today” + full list; uses food cost, waste, labor, low stock, expiring items. | ~180 |
| **foodCostService.js** | Food cost calculation only: `calculateFoodCost(tenantId, startDate, endDate)`, caching, and display helper `getFoodCostDisplay`. | ~120 |
| **wasteAnalysisService.js** | Waste calculation and reporting: `calculateWaste`, waste %, `getWasteDisplay`, waste-by-category, slow-moving and expiring items. | ~280 |
| **reportGeneratorService.js** | Reports and export: `getAvailableReports`, `exportReport`, trends, supplier ranking, period comparison, variance detection, labor/menu profitability. | ~350 |

The existing **analyticsService.js** becomes a **facade**: it delegates to these modules and keeps the same public API so routes do not need to change during migration.

---

## 2. Interface/API for Each Module

### 2.1 dashboardMetricsService.js

```js
// getDashboardMetrics(tenantId) → Promise<DashboardMetrics>
// getSavingsBreakdown(tenantId, startDate, endDate, monthlyDifference, periodLabel) → Promise<SavingsBreakdown>
// getFoodCostDisplay(foodCostResult, wasteTotal, totalSales) → DisplayInfo
// getWasteDisplay(wasteTotal, purchases, sales) → DisplayInfo
```

- **DashboardMetrics**: `weeklyLoss`, `monthlyLoss`, `foodCostPercentage`, `primeCost`, `wastePercentage`, `savingsBreakdown`, `periodInfo`, `weeklySalesByDay`, `lossByCategory`, `lossSummary`, `primeCostDisplay`, etc.
- **SavingsBreakdown**: `totalPotentialSavings`, `calculation`, `items`, `summary` (wasteIssues, foodCostIssues, etc.).
- **DisplayInfo**: `{ value, confidence, message, tooltip, dataRequirements? }`.

### 2.2 actionItemService.js

```js
// getActionItems(tenantId) → Promise<{ items, count, highPriority, mediumPriority }>
// getPriorityOneAction(tenantId) → Promise<ActionItem | null>   // NEW: single "Priority 1 Today"
```

- **ActionItem**: `{ id, priority, category, title, description, impact, status, action, potentialSavings? }`.
- `getPriorityOneAction` picks the single highest-impact action (e.g. largest potential savings or worst metric).

### 2.3 foodCostService.js

```js
// calculateFoodCost(tenantId, startDate, endDate) → Promise<FoodCostResult>
// getFoodCostDisplay(foodCostResult, wasteTotal, totalSales) → DisplayInfo
```

- **FoodCostResult**: `{ foodCost, totalPurchases, totalSales, period: { startDate, endDate } }`.

### 2.4 wasteAnalysisService.js

```js
// calculateWaste(tenantId, startDate, endDate) → Promise<WasteItem[]>
// getWasteDisplay(wasteTotal, purchases, sales) → DisplayInfo
// getSlowMovingItems(tenantId, daysThreshold?) → Promise<SlowMovingItem[]>
// getExpiringItemsAlerts(tenantId, daysAhead?) → Promise<ExpiringItem[]>
```

- **WasteItem**: `itemName`, `category`, `purchased`, `sold`, `wasted`, `unaccounted`, `wasteCost`, `estimatedWasteCost`, `totalLoss`, etc.
- **SlowMovingItem**: `item_name`, `daysSinceLastSale`, `isExpiringSoon`, etc.
- **ExpiringItem**: item and expiry info.

### 2.5 reportGeneratorService.js

```js
// getAvailableReports(tenantId) → Promise<ReportMeta[]>
// exportReport(tenantId, reportType, format, startDate?, endDate?) → Promise<Buffer|Object>
// getTrendsAnalysis(tenantId, periodType?, weeks?) → Promise<Trends>
// getSupplierRanking(tenantId, startDate, endDate) → Promise<SupplierRanking[]>
// comparePeriods(tenantId, period1Start, period1End, period2Start, period2End) → Promise<Comparison>
// calculateProductMargins(tenantId, startDate, endDate) → Promise<MarginItem[]>
// calculateLaborCost(tenantId, startDate, endDate) → Promise<LaborCostResult>
// getMenuProfitability(tenantId, startDate, endDate) → Promise<MenuProfitability[]>
// detectVariance(tenantId, startDate, endDate) → Promise<VarianceResult>
// getAllAlerts(tenantId) → Promise<Alert[]>
```

---

## 3. Critical Unit Tests to Write First

Focus on financial correctness; these tests should be written **before** splitting the monolith (against current `analyticsService`), then re-targeted to the new modules.

1. **Food cost %**  
   - Given purchases and sales in a period, assert `foodCost = (totalPurchases / totalSales) * 100` and edge cases (zero sales, zero purchases).

2. **Waste %**  
   - Assert `wastePercentage = (wasteDollars / salesDollars) * 100` (not waste/purchases). Test with zero sales.

3. **Savings / loss vs 28% target**  
   - Assert `difference = actualPurchases - (sales * 0.28)`; positive = loss, negative = gain. Test step-by-step breakdown values.

4. **Prime cost**  
   - Assert `primeCost = foodCost% + labor%` and that `isCritical === true` when prime cost > 100%.

5. **Period labels**  
   - Assert "This Week" / "Last N Days" / "This Month" based on actual day count in range.

6. **Savings breakdown aggregation**  
   - Assert `totalPotentialSavings` and category counts (wasteIssues, foodCostIssues, etc.) match summed item impacts.

7. **Action item food cost consistency**  
   - Assert action item food cost % uses the same period (e.g. month-to-date) as dashboard and matches dashboard metric.

---

## 4. Phased Migration Strategy

- **Phase 1 – Tests & facade (no behavior change)**  
  - Add the 5–7 critical unit tests above against `analyticsService`.  
  - Introduce thin wrappers in new files that call `analyticsService`; routes still use `analyticsService`.  
  - **Exit criterion:** All new tests pass; deployment unchanged.

- **Phase 2 – Extract food cost and waste**  
  - Implement `foodCostService` and `wasteAnalysisService` with the same logic as current code; move caching into these services or keep in facade.  
  - `analyticsService` calls `foodCostService` and `wasteAnalysisService` instead of internal methods.  
  - Re-run full test suite and manual smoke (dashboard, action items, reports).  
  - **Exit criterion:** Same API responses; tests still pass.

- **Phase 3 – Extract dashboard and action items**  
  - Implement `dashboardMetricsService` (getDashboardMetrics, getSavingsBreakdown, display helpers) and `actionItemService` (getActionItems, optionally getPriorityOneAction).  
  - `analyticsService` delegates to these modules.  
  - **Exit criterion:** Dashboard and action-item APIs unchanged; tests pass.

- **Phase 4 – Extract reports**  
  - Implement `reportGeneratorService` with all report/export/trends/supplier/labor/menu/variance/alerts.  
  - `analyticsService` delegates to it.  
  - **Exit criterion:** All report and export endpoints behave as before.

- **Phase 5 – Route-by-route switch (optional)**  
  - Update routes to call the specific service (e.g. `dashboardMetricsService.getDashboardMetrics`) instead of `analyticsService`.  
  - Deprecate `analyticsService` facade once all routes are migrated.

---

## 5. Effort Estimate

| Phase | Description | Story points | Engineer-weeks (1 dev) |
|-------|-------------|--------------|-------------------------|
| 1 | Tests + facade wrappers | 3 | ~0.5 |
| 2 | foodCostService + wasteAnalysisService | 5 | ~1 |
| 3 | dashboardMetricsService + actionItemService | 8 | ~1.5 |
| 4 | reportGeneratorService | 8 | ~1.5 |
| 5 | Route migration + cleanup | 3 | ~0.5 |
| **Total** | | **27** | **~5** |

Assumptions: one engineer, existing codebase knowledge; no new features. Add 10–20% buffer for integration issues and regression fixes.

---

## 6. File Layout After Refactor

```
backend/src/services/
  analytics/
    index.js              # Facade: re-exports or delegates to modules
    dashboardMetricsService.js
    actionItemService.js
    foodCostService.js
    wasteAnalysisService.js
    reportGeneratorService.js
  analyticsService.js     # Optional: thin facade that requires('./analytics') for backward compatibility
```

Routes can keep `require('../services/analyticsService')` until Phase 5, then switch to `require('../services/analytics')` or direct service requires.

---

## 7. Risk Mitigation

- **Caching:** Keep cache keys and TTL behavior identical when moving logic (e.g. same keys in `dashboardMetricsService` as in current `getDashboardMetrics`).  
- **Feature flags:** Pass through `ENABLE_PERFORMANCE_CACHE` and `CACHE_TTL_*` in each new service that uses cache.  
- **DB access:** New services use the same `db` and `date-fns` usage; no schema changes.  
- **Backward compatibility:** Facade preserves existing method signatures and response shapes until route migration.

This plan supports the Owner-First Dashboard (e.g. `getPriorityOneAction`, executive summary) and keeps financial calculations consistent and testable.
