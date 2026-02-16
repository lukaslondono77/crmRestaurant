# Safe Cleanup Verification Checklist

Use this checklist after navigation cleanup and analytics content hiding to ensure nothing is broken.

## 1. Navigation Test

- [ ] **Owner View** – `fila/core/owner-view.html` loads; executive summary and cards appear.
- [ ] **Loss Summary** – `fila/core/index.html` loads; P&L, period selector, priority box, and charts work.
- [ ] **Inventory Control** – `fila/core/products-list.html` loads (no 404).
- [ ] **Weekly Count** – `fila/core/inventory-count.html` loads.
- [ ] **Waste Tracking** – `fila/core/analytics.html` loads; waste metrics and restaurant sections visible; **Browser / Top Browsing / Visits By Country** sections are hidden.
- [ ] **Labor Cost Analysis** – `fila/core/reports.html` loads.
- [ ] **Menu Profitability** – links to products-list (or intended page); no 404.
- [ ] **Suppliers & Invoices** – `fila/core/invoices.html` loads.
- [ ] **Variance Detection** – `fila/core/analytics.html` loads.
- [ ] **Action Items** – `fila/core/analytics.html` loads.
- [ ] **Manual Data Entry** – `fila/core/manual-data-entry.html` loads.
- [ ] **Reports & Exports** – `fila/core/reports.html` loads.
- [ ] **Alerts** – `fila/core/alerts.html` loads.
- [ ] **Settings** – Account Settings, Change Password, Restaurant Settings sub-links work.
- [ ] **My Profile** – `fila/core/my-profile.html` loads.
- [ ] **Logout** – triggers logout (no 404).
- [ ] No 404s when clicking any sidebar link from any core page.

## 2. Waste / Analytics Dashboard Test

- [ ] Waste analytics still show correct data (e.g. waste amount, categories) when API is available.
- [ ] Charts that are restaurant-related still render (waste by category, trends).
- [ ] Tables that show restaurant data still populate.
- [ ] **Browser** table, **Top Browsing Pages Per Minute**, and **Visits By Country** are not visible (hidden by `.hide-non-restaurant`).
- [ ] **Slow Moving Items** and other restaurant sections remain visible.
- [ ] No JavaScript console errors on load or when switching tabs/sections.

## 3. Backend API Test

- [ ] `GET /api/dashboard/metrics` (with optional `?period=weekly`) returns 200 and expected shape.
- [ ] `GET /api/dashboard/executive-summary` returns 200 when Owner View is enabled.
- [ ] Data fetching for waste, inventory, sales still works (check browser Network tab).
- [ ] No CORS or 500 errors on dashboard or analytics pages.

## 4. Visual Check

- [ ] Sidebar layout is correct (logo, MAIN, SETTINGS, no APPS/PAGES/MODULES/OTHERS).
- [ ] Header and content area layout unchanged.
- [ ] CSS styles still apply (no broken buttons or cards).
- [ ] Mobile responsiveness intact (sidebar collapse, responsive grid).

## If Something Breaks

1. **Revert navigation**  
   Restore sidebar from backup or re-run from a backup copy of `fila/core/*.html` before cleanup.

2. **Show hidden sections again**  
   Remove the `.hide-non-restaurant` class from the analytics page, or in CSS set:
   ```css
   .hide-non-restaurant { display: block !important; }
   ```

3. **Keep backend unchanged**  
   Cleanup only touched frontend (sidebar HTML and analytics sections); no backend routes were modified.

## Backup Command (run before any cleanup)

```bash
cp -r fila/ fila-backup-$(date +%Y%m%d)/
```

## Files Modified by Cleanup

- **Phase 1:** Sidebar in 34 core HTML files replaced with restaurant menu (see `fila/scripts/apply-restaurant-menu.js` and `fila/core/restaurant-menu-snippet.html`).
- **Phase 2:** `fila/core/analytics.html` – wrapped Browser table and “Top Browsing / Visits By Country” row in `.hide-non-restaurant`; added CSS in `fila/assets/css/style.css`.
- **Phase 3:** `fila/assets/js/restaurant-menu.js` (reference config); this checklist.
