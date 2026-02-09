# Verification Report — Cloudignite Backend

## PART 1: Calculation Verification

### 1. Food Cost Percentage

**Formula:** `foodCostPercent = (totalCostOfGoodsSold / totalSales) × 100`

**Current implementation** (`analyticsService.calculateFoodCost`):

- **Cost of goods sold:** `SUM(purchases.total_amount)` for the period (tenant- and date-filtered).
- **Total sales:** `SUM(sales.total_sales)` for the same period.
- **Formula:** `totalSales > 0 ? (totalPurchases / totalSales) * 100 : 0` (avoids division by zero).

**Note:** We use `purchases.total_amount` and `sales.total_sales` (header-level). Using `SUM(purchase_items.total_price)` and `SUM(sales_items.total_price)` would be equivalent when invoice/POS data are consistent. Current choice is correct for primary food cost %.

**Edge cases:** Zero sales → 0%; zero purchases with sales → 0%. Handled.

---

### 2. Prime Cost Percentage

**Formula:** `primeCostPercent = foodCostPercent + laborCostPercent`

**Current implementation:**

- **Food:** From `calculateFoodCost` (see above).
- **Labor:** Fixed `32.8%` (TODO: replace with real labor data when available).
- **Target:** 55–65% (industry norm). Shown in UI.

**Status:** Implementation is correct. Labor is a placeholder until labor data exists.

---

### 3. Loss Summary

**Definitions:**

- **Theoretical cost:** `totalSales × 0.28` (28% food-cost target).
- **Actual cost:** `totalPurchases` for the period.
- **Difference:** `actual − theoretical`. Positive = over target = loss; negative = under target = gain.
- **Loss amount:** `|difference|` (display).
- **Loss percent:** `theoretical > 0 ? (|difference| / theoretical) × 100 : 0`.

**Current implementation:** `getDashboardMetrics` and `getSavingsBreakdown` use `TARGET_FOOD_COST = 0.28`, `expectedPurchases = totalSales × 0.28`, and the same difference logic. **Fix applied:** `getSavingsBreakdown` now uses `0.28` (was `0.35`).

**Edge cases:** Zero sales → theoretical 0, lossPercent 0. Handled.

---

### 4. Period Comparison (e.g. `comparePeriods`)

**Formula:** `percentChange = ((period2 − period1) / period1) × 100` when `period1 ≠ 0`.

**Current implementation:** `safePct(delta, base)` returns `0` when `base` is 0 or missing. Applied to `salesChange`, `purchasesChange`, `wasteChange`, `profitChange`. **Fix applied:** division-by-zero guarded.

---

### 5. Indexes

Migration `020_add_performance_indexes.sql` defines:

- `idx_purchases_tenant_date`, `idx_purchases_tenant`
- `idx_sales_tenant_date`, `idx_sales_tenant`
- `idx_waste_tenant_date`, `idx_waste_tenant`
- `idx_inventory_tenant_name`, `idx_inventory_tenant_category`
- Plus indexes for purchase_items, sales_items, etc.

No extra indexes required for the verified calculations.

---

### 6. Caching

- **Food cost:** Cached when `ENABLE_PERFORMANCE_CACHE` is on (key: `food_cost:{tenantId}:{startDate}:{endDate}`).
- **Dashboard metrics:** Uses food-cost cache internally. Full metrics caching can be added later via the same feature flag.

---

## Summary

| Item | Status |
|------|--------|
| Food cost % | Correct; zero-sales safe |
| Prime cost % | Correct; labor placeholder |
| Loss summary | Correct; 0.28 target; zero-safe |
| comparePeriods | Division-by-zero guarded |
| getSavingsBreakdown | Uses 0.28 (fixed) |
| Indexes | Present in migration 020 |
| Caching | Food cost cached when flag on |

All verified calculations are correct and edge cases are handled.

---

## Final verification & optimizations (applied)

- **Test suite:** `npm run test:endpoints` (or `node scripts/test-all-endpoints.js [baseUrl]`). Covers health, auth (register, login, me), dashboard (metrics, action-items, monthly-report), inventory, analytics smoke, Square sync.
- **Performance:** Dashboard metrics cached when `ENABLE_PERFORMANCE_CACHE` is on (key `dashboard_metrics:{tenantId}:{monthStart}`, TTL `CACHE_TTL_DASHBOARD`). Food-cost caching unchanged. Indexes in migration 020.
- **Error handling:** `ErrorCodes.INSUFFICIENT_DATA` added. `formatErrorResponse` supports `error.details.suggestion` for client-facing hints. `comparePeriods` division-by-zero guarded.
- **Deployment:** `.env.example` added. `GET /api/healthz?detailed=1` returns database, uptime, memory. `trust proxy` set in production. `DEPLOYMENT_CHECKLIST.md` added.
