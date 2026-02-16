# Owner-First Dashboard MVP — User Story & Technical Specification

## User Story

**As a** restaurant owner,  
**I want to** see the financial health and the single most important action for my business within 10 seconds of opening the app,  
**so that** I can make faster, data-driven decisions.

---

## 1. Crisis Banner Logic

A **Crisis Banner** appears at the very top of the Owner View when any of the following conditions are true. It must be the first thing the owner sees.

| Rule | Condition | Banner color | Example message |
|------|-----------|--------------|-----------------|
| Prime Cost critical | Prime Cost > 68% for **3+ consecutive days** (using rolling 3-day window) | **RED** | "Prime Cost has been over 68% for 3 days. Immediate action recommended." |
| Prime Cost over 100% | Prime Cost > 100% on current period (day/week/month) | **RED** | "Prime Cost over 100% — business is losing money on food + labor." |
| Food cost spike | Food cost % > 35% for **3+ consecutive days** | **AMBER** | "Food cost has been over 35% for 3 days." |
| Waste spike | Waste % > 10% for **3+ consecutive days** | **AMBER** | "Waste has been over 10% for 3 days." |
| No data | No sales or no purchases in the last 7 days | **GRAY** | "Add sales and purchase data to see your financial health." |

- **Consecutive days:** Backend computes daily Prime Cost / Food cost / Waste % for the last 7 days; if the condition holds for at least 3 consecutive days (e.g. Mon–Wed), the rule triggers.
- **Single banner:** Only one banner is shown; priority order: Prime > 100% → Prime > 68% for 3 days → Food cost 3 days → Waste 3 days → No data.
- **Dismissal:** Optional: allow "Dismiss for 24h" (stored in tenant or browser); banner reappears after 24h if condition still true.

---

## 2. "Priority 1 Today" Card — Algorithm

The system chooses **exactly one** action as **Priority 1 Today**.

**Inputs:** Same period as dashboard (e.g. month-to-date). Use: food cost %, waste %, prime cost, loss amount, expiring items, low stock, and (when available) variance/labor.

**Algorithm (first match wins):**

1. **Reduce Waste** — If waste % > 5% **and** waste $ is the largest cost driver in the period → Priority 1 = "Reduce Waste" with `potentialSavings = min(waste$, loss from waste)` and link to waste breakdown.
2. **Adjust Ordering** — If food cost % > 28% **and** food cost overrun (actual − target) is the largest loss component → Priority 1 = "Adjust Ordering" with `potentialSavings = food cost overrun` and link to purchasing/invoices.
3. **Review Invoice** — If there are unpaid or unreconciled invoices in the period **or** variance (invoice vs. expected) > 10% → Priority 1 = "Review Invoice" with link to invoices.
4. **Use Expiring Inventory** — If any items expire in the next 7 days **and** total value of expiring items > $X (e.g. $50) → Priority 1 = "Use Expiring Inventory" with count and value.
5. **Restock Critical Items** — If low-stock count > 0 **and** no higher-priority action → Priority 1 = "Restock Critical Items" with count and link to inventory.
6. **Default** — If none of the above: "You're on track — review detailed metrics below" (no action link, or link to full dashboard).

**Output:** Single object: `{ id, title, description, actionLabel, actionUrl, potentialSavings, category }`.

---

## 3. Four-Card Executive Summary

The **4-card row** below the crisis banner (and below Priority 1 Today) shows:

| # | Metric | Definition | Source |
|---|--------|------------|--------|
| 1 | **Daily Burn Rate** | (Monthly loss or monthly negative cash impact) ÷ days in period. If gain, show as "Daily Runway" or $0 burn. | `monthlyLoss / monthDayCount` or from P&L; period = current month to date. |
| 2 | **Projected Monthly P&L** | If period has enough data: extrapolate (period loss/gain ÷ days) × days in month. Label "Projected" and show as profit or loss. | From dashboard `monthlyLoss` / `monthlyIsLoss` and `monthDayCount`. |
| 3 | **Top Cost Driver** | Single biggest driver: "Food cost overrun", "Waste", or "Labor" (whichever has largest $ impact in period). | From savings breakdown / loss by category. |
| 4 | **Food Cost % vs. Goal** | Current food cost % and goal (e.g. 28%); delta (e.g. "+4.2% over"). | From dashboard `foodCostDisplay` / `foodCostPercentage` and target 28%. |

Cards are tappable/clickable to expand or navigate to the relevant detail view (waste, invoices, inventory, etc.).

---

## 4. Mock-up Description (Layout)

- **Top:** Full-width **Crisis Banner** (red / amber / gray). One line of copy; optional "Dismiss" and "See details" link.
- **Below banner:** **Priority 1 Today** card: one primary button (e.g. "Reduce Waste →") and one line of explanation; optional `potentialSavings` (e.g. "Potential savings: $1,200").
- **Next row:** **4-card grid** (responsive: 1 col mobile, 2 cols tablet, 4 cols desktop):
  - Card 1: Daily Burn Rate  
  - Card 2: Projected Monthly P&L  
  - Card 3: Top Cost Driver  
  - Card 4: Food Cost % vs. Goal  
- **Below:** **Collapsible "Detailed View"** (e.g. accordion or "Show full dashboard") that expands to show the existing dashboard: weekly/monthly loss, savings breakdown, charts (sales by day, loss by category), and full action items list.

Goal: Owner can answer "Is there a crisis?" and "What should I do first?" in one glance; details remain one click away.

---

## 5. Backend Changes — New/Modified API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| **GET** | `/api/dashboard/executive-summary` | Single payload for Owner View: crisis banner state, Priority 1 action, 4-card metrics (daily burn, projected P&L, top cost driver, food cost vs goal). Optional query: `tenantId` (or from auth). |
| **GET** | `/api/dashboard/metrics` | Existing; may be extended with `dailyBurnRate`, `projectedMonthlyPandL`, `topCostDriver`, `crisisBanner` so one call can serve both summary and detailed view. |
| **GET** | `/api/dashboard/action-items` | Existing; may be extended with `priorityOne: { ... }` for the single Priority 1 Today item. |

**Recommended:** Implement **`GET /api/dashboard/executive-summary`** that returns:

```json
{
  "crisisBanner": {
    "visible": true,
    "severity": "red",
    "message": "Prime Cost has been over 68% for 3 days.",
    "rule": "PRIME_COST_3_DAYS"
  },
  "priorityOne": {
    "id": "REDUCE_WASTE",
    "title": "Reduce Waste",
    "description": "Waste is 8.2% of sales this period.",
    "actionLabel": "Reduce Waste →",
    "actionUrl": "/#/waste",
    "potentialSavings": 1200,
    "category": "Waste"
  },
  "cards": {
    "dailyBurnRate": { "value": 120, "label": "Daily Burn Rate", "periodDays": 2 },
    "projectedMonthlyPandL": { "value": -3600, "isLoss": true, "label": "Projected Monthly P&L" },
    "topCostDriver": { "name": "Food cost overrun", "value": 800, "label": "Top Cost Driver" },
    "foodCostVsGoal": { "current": 32.5, "goal": 28, "delta": 4.5, "overGoal": true }
  },
  "period": { "start": "2025-02-01", "end": "2025-02-02", "label": "Last 2 Days" }
}
```

**Implementation notes:**

- **Crisis banner:** New helper (e.g. in `dashboardMetricsService` or `actionItemService`) that, for the tenant, computes daily Prime Cost / Food cost / Waste % for the last 7 days and applies the 3-day consecutive rules.
- **Priority 1:** Implement `getPriorityOneAction(tenantId)` in `actionItemService` using the algorithm in §2; call it from executive-summary and optionally from action-items.
- **Daily Burn Rate:** `monthlyLoss / monthDayCount` (only when `monthlyIsLoss`); otherwise 0 or "Runway" as needed.
- **Projected P&L:** `(periodLossOrGain / periodDays) * daysInCurrentMonth`; label clearly as "Projected".
- **Top Cost Driver:** From existing savings breakdown / loss by category (largest $ impact).
- **Food Cost vs. Goal:** From existing `foodCostDisplay` / `foodCostPercentage`; goal = 28.

---

## 6. Acceptance Criteria (Summary)

- [ ] Crisis banner appears when and only when rules in §1 are met; severity and copy match spec.
- [ ] Priority 1 Today shows exactly one action; algorithm order and links match §2.
- [ ] Four executive cards show Daily Burn Rate, Projected Monthly P&L, Top Cost Driver, Food Cost % vs. Goal as in §3.
- [ ] Layout matches §4 (banner → Priority 1 → 4 cards → collapsible detailed view).
- [ ] `GET /api/dashboard/executive-summary` returns the structure above; existing dashboard and action-items endpoints remain working.
- [ ] Owner can understand "crisis?" and "what to do first?" within ~10 seconds of load.

This spec is ready for implementation once the analytics refactor (e.g. `dashboardMetricsService`, `actionItemService`) is in place or in parallel using the current facade.
