# Development Roadmap: From Diagnosis to Prescription

The dashboard identifies problems; the software's real value is **guiding the solutions**. This roadmap turns every red number into a clear, actionable step with a dollar sign attached.

---

## Part 1: For Developers — Enhancing the Software

### A. From "What's Wrong" to "How to Fix It"

| Feature | Status | Notes |
|--------|--------|-------|
| **Link Top Loss Sources to guided workflows** | ✅ Done | "How to fix" opens modal with savings calc, probable causes, actionable steps |
| **Savings calculator per alert** | ✅ Done | Waste, labor, supplier, shrinkage, menu each show "Reducing X would save $Y" |
| **Prime Cost widget** | ✅ Done | Food % + Labor %; target 55–65%; displayed on dashboard |
| **Guided Fix modal** | ✅ Done | Per loss type: immediate calculation, causes checklist, steps, link to module |
| **No-inventory dead end → CTA** | ✅ Done | "5-minute setup: upload 3 invoices" + link to Manual Data Entry |
| **Action Items → Guided Fix** | ✅ Done | Food waste, Food cost, Labor cost clickable; open same Guided Fix modal |
| **Manual Data Entry 5‑min setup** | ✅ Done | Banner on Manual Data Entry: "5‑minute inventory setup", Start with invoices CTA |
| **Backend Prime Cost** | ✅ Done | `getDashboardMetrics` returns `primeCost`; frontend uses it when available |
| **Monthly Profit Report** | ✅ Done | POS-driven report: executive summary, profit leakage, menu performance, action plan, blind spots. API: `GET /api/dashboard/monthly-report?year=&month=`. New tab on Reports page. |
| **Business Logic Audit** | ✅ Done | Food Cost % progressive disclosure (`foodCostDisplay`), Waste % (`wasteDisplay`), Prime Cost when food=0 (`primeCostDisplay`), Loss definitions & savings label (`lossDefinitions`, `savingsDisplay`). Expiring alerts: `valueAtRisk`, `actions`, `recommendation`. |

### B. Critical Calculations the Software Should Perform

| Metric | Formula | Dashboard / Backend |
|--------|---------|---------------------|
| **Actual Food Cost %** | `(Beginning Inv + Purchases - Ending Inv) / Food Sales` | Uses simplified formula without full inventory. **Priority:** weekly inventory count. |
| **Theoretical vs Actual (Variance)** | Theoretical = sum(recipe cost × qty sold); Actual = from above; Variance = Actual − Theoretical | **TODO:** Variance Detection module. Killer feature. |
| **Prime Cost** | `COGS (Food + Beverage) + Total Labor` | ✅ **Done.** Target 55–65%. Shown on dashboard. |

### C. Development Priorities (Phases)

---

## Phase 1: Close the Data Loop (MVP Complete)

**Goal:** No inventory data = guesses, not insights.

| Priority | Task | Result |
|----------|------|--------|
| **#1** | Build a simple **inventory count system** (mobile-friendly) | ✅ **Done.** Weekly Count page, `inventory_counts` table, GET/POST `/api/inventory/counts` and `/counts/items`. |
| **#2** | **Invoice import / OCR** | Auto-populate supplier prices and purchase data; reduce manual entry |

**Outcome:** "Food Cost %" and "Highest Cost Inventory Items" become accurate and actionable. *Next:* Wire analytics to use (Begin + Purchases − End) / Sales when counts exist.

---

## Phase 2: Build the "Brain" (Intelligent Analysis)

| Priority | Task | Result |
|----------|------|--------|
| **#1** | **Variance Detection** | Calculate Theoretical vs Actual food cost; attribute loss to waste, theft, error |
| **#2** | **Interactive Action Items** | Step-by-step guides + savings calculators (expand beyond Top Loss Sources) |
| **#3** | **Prime Cost as main KPI** | ✅ **Done.** Track and trend over time |

---

## Phase 3: Predictive & Prescriptive

| Priority | Task | Result |
|----------|------|--------|
| **#1** | **Predictive ordering** | Use history in Reports to predict weekly ordering needs |
| **#2** | **Pre-waste alerts** | e.g. "10 lbs chicken breast reaching 4 days old. Suggested: run a chicken special tonight." |

---

## Part 2: For the Restaurant Owner — Action Plan from the Dashboard

Guide users through this sequence based on their dashboard.

### Week 1: Tackle the Biggest Loss — Food Waste (Saves ~$2,100+ / month)

1. **Conduct a waste track** — Use **Waste Tracking**. For 3–7 days, weigh and log everything thrown out: spoiled ingredients, plate returns, prep trim.
2. **Identify the source** — Spoiled spinach (storage) vs uneaten fries (portion) vs trim (prep).
3. **Adjust & train** — Fix storage, refine prep quantities, review portion sizes.

### Week 2: Optimize Labor (Saves ~$420+ / week)

1. Use **Labor Cost Analysis**. Compare sales vs labor hours by day-part.
2. **Right-size schedules** — Shift start/end times; avoid overstaffing on slow weekdays.
3. **Cross-train staff** — Run with fewer people without losing service.

### Week 3: Negotiate & Control Inventory (e.g. ~$227+ on chicken alone)

1. **Suppliers & Invoices** — Address the chicken supplier about the +12% increase.
2. **Get competitive quotes** — Use the increase as leverage.
3. **Start weekly inventory counts** — Non-negotiable. Reduces shrinkage and unlocks accurate food cost. Use **Manual Data Entry** or a mobile count feature.

### Week 4: Menu Engineering (Increases profit, not just saves cost)

1. **Menu Profitability** — Find the 5 low-margin (&lt;20%) items.
2. **Decide per item** — Raise price? Lower cost (e.g. garnish)? Or replace with a higher-margin dish?
3. **Promote high-margin stars** — Specials, server incentives.

---

## Summary

- **Dashboard = health monitor** (shows high fever / losses).
- **Roadmap = doctor** — prescribe specific actions, calculate exact savings, guide the owner back to profitability.

**Focus:** Make data entry effortless, and **attach a dollar sign and next step to every red number**.

---

*Last updated: Business Logic Audit. Implemented: **Food Cost %** progressive disclosure (estimate vs add-data, confidence, tooltips), **Waste %** display with confidence, **Prime Cost** when food=0 ("Add data"), **Loss definitions** & **Savings** label/tooltips, **Expiring Alerts** value-at-risk + actions + recommendations. Plus Prime Cost, Guided Fix, Monthly Report, Weekly Count, etc.*
