# Frontend Structure — Cloudignite Cost Control

Static HTML/CSS/JS frontend served from `fila/`. No framework; vanilla JS with global services.

---

## Folder structure

```
fila/
├── assets/
│   ├── css/           # Styles (sidebar-menu, style, etc.)
│   ├── js/
│   │   ├── api/       # API client
│   │   │   └── apiService.js
│   │   ├── auth/      # Auth logic & helpers
│   │   │   ├── authService.js
│   │   │   └── authHelper.js
│   │   ├── sidebar/
│   │   │   └── sidebarService.js
│   │   ├── config.js
│   │   ├── custom/    # Charts, maps, etc.
│   │   ├── sidebar-menu.js, data-table.js, ...
│   │   └── *.min.js   # Libs (Bootstrap, ApexCharts, etc.)
│   ├── scss/
│   ├── images/
│   └── fonts/
├── index.html         # Main dashboard (Loss Summary)
├── sign-in.html       # Login
├── sign-up.html       # Registration
├── basic-elements.html # Manual Data Entry / Invoice upload
├── analytics.html     # Waste, margins, etc.
├── reports.html       # Monthly report, trends, alerts
├── inventory-count.html
├── products-list.html
├── manual-data-entry.html  # Redirect → basic-elements.html
├── server.py          # Dev server (port 3000)
└── *.html             # ~100+ pages (settings, HR, CRM, etc.)
```

---

## 1. API service

**File:** `assets/js/api/apiService.js`

- **Singleton:** `window.apiService` (global).
- **Base URL:** `window.APP_CONFIG.API_BASE_URL` or `http://localhost:8000/api` in dev.
- **Auth:** Uses `window.authService.getToken()` for `Authorization: Bearer <token>`.
- **Central `request(endpoint, options)`:**
  - JSON by default.
  - 401 → clear auth, redirect to `sign-in.html`.
  - Handles HTML error pages, network errors, and backend-down messages.

**Main methods (cost-control):**

| Method | Purpose |
|--------|--------|
| `getDashboardMetrics()` | Loss summary, food cost, prime cost, savings |
| `getActionItems()` | Action items for dashboard |
| `getMonthlyReport(year, month)` | Monthly profit report |
| `getProductMargins(start, end)` | Product margins |
| `getTrends(periodType, periods)` | Trends |
| `getSupplierRanking(start, end)` | Supplier ranking |
| `comparePeriods(...)` | Period comparison |
| `getAlerts(daysAhead)` | Expiring items, etc. |
| `getWasteAnalysis(start, end)` | Waste analysis |
| `getWasteRecords(start, end)` | Waste records |
| `getPOSReports()` | POS reports |
| `getInvoices()` | Invoices |
| `uploadInvoice(file, formData)` | Invoice upload |
| `uploadPOSReport(file, formData)` | POS upload |
| `recordWaste(wasteData, file)` | Record waste |
| `syncSquareSales()` | Square sync |
| `getInventory(filters)` | Inventory list |
| `getInventoryItem(id)` | Single item |
| `updateInventoryItem(id, data)` | Update item |
| `getInventoryCountItems()` | Count form data |
| `submitInventoryCount(payload)` | Submit count |
| `getProfile()` | User profile |
| `updateProfile(data)` | Update profile |

Plus calendar, contacts, chat, kanban, files, e‑commerce, etc.

**Used by:** `index.html`, `analytics.html`, `reports.html`, `basic-elements.html`, `inventory-count.html`, `products-list.html`, `settings.html`, `my-profile.html`, `sidebarService.js`.

---

## 2. Authentication

### `assets/js/auth/authService.js`

- **Singleton:** `window.authService`.
- **Storage:** `localStorage` — `restaurant_cost_control_token`, `restaurant_cost_control_user`, `restaurant_cost_control_tenant`.
- **Methods:**
  - `getToken()`, `getCurrentUser()`, `getCurrentTenant()`
  - `isAuthenticated()` (token + expiry check)
  - `setAuthData(token, user, tenant)`, `clearAuthData()`
  - `login(email, password)` → POST `/api/auth/login`
  - `register(companyName, email, password, firstName, lastName)` → POST `/api/auth/register`
  - `logout()` → clear + redirect to `sign-in.html`
  - `getCurrentUserInfo()` → GET `/api/auth/me`
  - `requireAuth()` → redirect to login if not authenticated

**Note:** Login/register use hardcoded `http://localhost:8000/api`; consider using `apiService` or `APP_CONFIG.API_BASE_URL` for consistency.

### `assets/js/auth/authHelper.js`

- IIFE, runs on load.
- Ensures `authService` is loaded (injects script if missing).
- **`checkAuthAndUpdateLinks()`:**
  - Validates token; clears if invalid/expired.
  - Redirects to `sign-in.html` when not authenticated (except on `sign-in.html` / `sign-up.html`).
- **`updateLogoutLinks()`:** Binds logout to `a[href*="logout"]` and similar; prevents default, calls `authService.logout()`.

### Auth pages

- **`sign-in.html`:** Login form; uses `authService.login`, then redirect.
- **`sign-up.html`:** Registration; uses `authService.register`.

**Included on:** Most app pages (auth scripts often loaded before `apiService` / `sidebarService`).

---

## 3. Main page components

### `index.html` — Main dashboard (Loss Summary)

- **Layout:** Sidebar + header + main content.
- **Scripts (order):** Bootstrap, sidebar-menu, Quill, data-table, SimpleBar, ApexCharts, ECharts, etc. → `authService` → `apiService` → `sidebarService`.
- **Auth:** `DOMContentLoaded` → `authService.isAuthenticated()`; if not, redirect to `sign-in.html`. Optionally `getCurrentUserInfo()`.
- **Data:** Calls `apiService.getDashboardMetrics()`, `getActionItems()`, etc. Populates cards, charts, tables, “Recently Captured Data”, “Savings Breakdown” modal.
- **Other:** Seed/init logic, ApexCharts for loss/sales.

### Other cost-control pages

| Page | Role |
|------|------|
| `analytics.html` | Waste, margins, slow-moving, Square-related |
| `reports.html` | Monthly report, Product Margins, Trends, Suppliers, Compare, Alerts |
| `basic-elements.html` | Manual Data Entry: invoice upload, POS upload, waste form, Square sync |
| `inventory-count.html` | Weekly count, inventory, counts UI |
| `products-list.html` | Inventory list, CRUD |

### Shared UI

- **Sidebar:** In every app HTML; logo, nav, theme toggle.
- **Header:** Search, notifications, user menu (profile, logout).
- **Preloader:** “Cloudignite” animation before content.

---

## 4. State / config (no global store)

### `assets/js/config.js`

- Sets `window.APP_CONFIG`:
  - `API_BASE_URL` (dev: `http://localhost:8000/api`; prod: same-origin `/api`).
  - `ENV`, `FEATURES`, `REQUEST_TIMEOUT`, `UPLOAD_TIMEOUT`, `DEFAULT_PAGE_SIZE`, etc.
- **Usage:** `apiService` reads base URL from here (or equivalent).

### `assets/js/sidebar/sidebarService.js`

- **Sidebar “state” and behavior:**
  - `getCurrentPage()` from `location.pathname`.
  - `setActiveMenuItem()` — active nav based on current page.
  - `updateUserInfo()` — user name/avatar in sidebar/header (can use `apiService` when available).
  - `initSearch()`, `initSidebarToggle()`, `initSettings()`.
- **No global app state:** Each page loads its own scripts and fetches what it needs.

### Auth state

- Stored in **`localStorage`** via `authService`; no Redux/Vue/React store.

---

## 5. Script load order (typical app page)

1. `bootstrap.bundle.min.js`
2. `sidebar-menu.js`
3. Optional: `quill`, `data-table`, `simplebar`, `apexcharts`, `echarts`, etc.
4. `custom/*.js` (charts, maps, custom)
5. `auth/authService.js`
6. `auth/authHelper.js` (optional; many pages have it)
7. `api/apiService.js` (only on API-using pages)
8. `sidebar/sidebarService.js`

**Note:** `config.js` is not consistently included; `apiService` can also derive base URL itself. For predictability, load `config.js` before `apiService` where used.

---

## 6. Quick reference — key files

| Concern | File(s) |
|--------|---------|
| **API** | `assets/js/api/apiService.js` |
| **Auth logic** | `assets/js/auth/authService.js` |
| **Auth UI / redirect / logout** | `assets/js/auth/authHelper.js` |
| **Config / env** | `assets/js/config.js` |
| **Sidebar / nav state** | `assets/js/sidebar/sidebarService.js` |
| **Main dashboard** | `index.html` |
| **Login** | `sign-in.html` |
| **Register** | `sign-up.html` |
| **Manual Data Entry** | `basic-elements.html` |
| **Reports** | `reports.html` |
| **Analytics** | `analytics.html` |

---

## 7. Running the frontend

- **Dev server:** `python3 server.py` in `fila/` → `http://localhost:3000`.
- **Backend:** `cd backend && npm run dev` → `http://localhost:8000`.
- Frontend calls backend at `APP_CONFIG.API_BASE_URL` / `http://localhost:8000/api`.
