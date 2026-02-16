# Frontend–Backend Specification

**Purpose:** Extract all backend requirements from frontend code. Use this to implement or validate API, data models, and business logic.

---

## Summary

| Area | Endpoints | Notes |
|------|-----------|--------|
| **Auth** | `POST /auth/login`, `POST /auth/register`, `GET /auth/me` | JWT in `Authorization`; store token, user, tenant in localStorage |
| **Dashboard** | `GET /dashboard/metrics`, `/action-items`, `/monthly-report`, `/waste-analysis`, `/slow-moving`, etc. | Metrics include `savingsBreakdown`, `lossSummary`, `foodCostDisplay`, `wasteDisplay` |
| **Analytics** | `GET /analytics/food-cost`, `product-margins`, `trends`, `suppliers`, `compare`, `alerts`, `waste-analysis` | Used by index, analytics, reports |
| **Data capture** | `GET/POST /pos/reports`, `GET/POST /invoices`, `GET/POST /waste`, `POST /square/sync-today` | FormData for uploads; waste: `itemName`, `quantity`, `costValue`, `wasteDate`, `reason`, `notes`, optional `image` |
| **Inventory** | `GET/POST/PUT/DELETE /inventory`, `GET /inventory/counts/items`, `POST /inventory/counts` | Count payload: `{ countDate, items: [{ itemName, quantity, ... }] }` |
| **Profile** | `GET /users/profile`, `PUT /users/profile` | User fields: name, email, phone, address, country, bio, profession, company, social |
| **Seed** | `POST /seed/initialize` | Used by index / inventory-count when metrics empty or API fails |
| **Modules** | Todos, Calendar, Contacts, Chat, Email, Kanban, Files, E‑commerce, CRM, Projects, LMS, Helpdesk, HR, Events, Social, School, Hospital | See Phase 1 for full list |

**Important:** List endpoints (`/invoices`, `/pos/reports`, `/waste`) must return **arrays** (or `data.invoices` / `data.reports` / `data.wasteRecords`). Frontend uses `.slice()` and iteration; non-array responses cause `invoices.slice is not a function`–type errors.

---

## Phase 1: API Endpoint List

All endpoints are under `API_BASE_URL` (dev: `http://localhost:8000/api`). Auth: `Authorization: Bearer <token>` unless noted.

### Authentication (no auth)
| Method | Endpoint | Parameters | Request Body | Response |
|--------|----------|------------|--------------|----------|
| POST | `/auth/login` | — | `{ email, password }` | `{ success, data: { token, user, tenant } }` |
| POST | `/auth/register` | — | `{ companyName, email, password, firstName, lastName }` | `{ success, data: { token, user, tenant } }` |
| GET | `/auth/me` | — | — | `{ success, data: { user, tenant } }` |

### Dashboard
| Method | Endpoint | Parameters | Response |
|--------|----------|------------|----------|
| GET | `/dashboard/metrics` | — | `{ data: { weeklyLoss, monthlyLoss, foodCostPercentage, primeCostPercent, wasteCost, wastePercentage, savings, lossSummary, savingsBreakdown, foodCostDisplay, wasteDisplay, weeklyLossDisplay, monthlyLossDisplay, lossDefinitions, ... } }` |
| GET | `/dashboard/action-items` | — | `{ data: { items: [...], count } }` or array |
| GET | `/dashboard/monthly-report` | `year`, `month` | `{ data: { month, revenue, expenses, profit, comparisons, ... } }` |
| GET | `/dashboard/waste-analysis` | `startDate`, `endDate` | Waste analysis (by category, totals) |
| GET | `/dashboard/slow-moving` | `days` | Slow-moving items list |
| GET | `/dashboard/labor-cost` | `startDate`, `endDate` | Labor cost data |
| GET | `/dashboard/menu-profitability` | `startDate`, `endDate` | Menu profitability |
| GET | `/dashboard/variance` | `startDate`, `endDate` | Variance detection |
| GET | `/dashboard/reports` | — | Available reports |
| POST | `/dashboard/export` | — | `{ reportType, format, startDate, endDate }` |
| GET | `/dashboard/alerts` | — | Alerts list |

### Analytics
| Method | Endpoint | Parameters | Response |
|--------|----------|------------|----------|
| GET | `/analytics/food-cost` | `startDate`, `endDate` | Food cost calculation (breakdown modal) |
| GET | `/analytics/product-margins` | `startDate`, `endDate` | `[{ product, sales, cost, margin, marginPercent }]` |
| GET | `/analytics/trends` | `periodType`, `periods` | `{ labels, datasets }` |
| GET | `/analytics/suppliers` | `startDate`, `endDate` | Supplier ranking |
| GET | `/analytics/compare` | `period1Start`, `period1End`, `period2Start`, `period2End` | Period comparison |
| GET | `/analytics/alerts` | `daysAhead` | `{ alerts, count }` |
| GET | `/analytics/waste-analysis` | `startDate`, `endDate` | Detailed waste (alternative to dashboard) |

### POS, Invoices, Waste, Square
| Method | Endpoint | Parameters / Body | Response |
|--------|----------|-------------------|----------|
| GET | `/pos/reports` | — | `{ data: { reports } }` or array. Each: `id`, `report_date`, `total_sales`, `total_transactions`, ... |
| POST | `/pos/upload` | FormData: `image` (file) | `{ success, reportId?, itemsProcessed? }` |
| GET | `/invoices` | — | `{ data: { invoices } }` or array. Each: `id`, `vendor`, `purchase_date`, `invoice_number`, `total_amount`, ... |
| POST | `/invoices/upload` | FormData: `image` (file) | `{ success, invoiceId?, itemsAdded? }` |
| GET | `/waste` | `startDate`, `endDate` | `{ data: { wasteRecords } }` or array. Each: `id`, `item_name`, `quantity`, `cost_value`, `waste_date`, `reason`, ... |
| POST | `/waste` | FormData: `itemName`, `quantity`, `costValue`, `wasteDate`, `reason`, `notes`, optional `image` | `{ success, id? }` |
| POST | `/square/sync-today` | — | `{ success, data?: { date, totalSales, totalTransactions, averageTicket, reportPeriod, items } }` |
| GET | `/square/sales` | `startDate`, `endDate` | Sales data |
| GET | `/square/payments` | `startDate`, `endDate` | Payments data |
| GET | `/square/inventory-all` | `catalogObjectIds` (optional) | Square inventory |
| GET | `/square/catalog-detailed` | — | Catalog |
| GET | `/square/inventory-changes` | `startDate`, `endDate`, `catalogObjectIds` | Inventory movements |

### Inventory
| Method | Endpoint | Parameters | Response |
|--------|----------|------------|----------|
| GET | `/inventory` | `category`, `lowStock`, `threshold`, `page`, `limit` | `{ data: { items, total?, page?, pages? } }` or `{ items }` |
| GET | `/inventory/low-stock` | `threshold` | Low-stock items |
| GET | `/inventory/:id` | — | Single item |
| POST | `/inventory` | JSON body | Create item |
| PUT | `/inventory/:id` | JSON body | Update item |
| DELETE | `/inventory/:id` | — | Delete item |
| GET | `/inventory/counts/items` | — | Items for count sheet `[{ id, name, currentStock, unit, category, ... }]` |
| GET | `/inventory/counts` | `weekEnd` | Past counts |
| POST | `/inventory/counts` | `{ countDate, items: [{ itemName, quantity, unitPrice?, category?, notes? }] }` | `{ success, adjustments? }` |

### Users & Profile
| Method | Endpoint | Parameters | Response |
|--------|----------|------------|----------|
| GET | `/users/profile` | — | `{ success, data: { user } }`. User: `id`, `first_name`, `last_name`, `email`, `phone`, `address`, `country`, `bio`, `profession`, `companyName`, `company_website`, `facebook`, `twitter`, `linkedin`, `youtube`, `skills`, `role`, `city`, `state`, `created_at`, ... |
| PUT | `/users/profile` | JSON body | `{ success }` |
| GET | `/users/profile/:userId` | — | User profile by ID |
| GET | `/users/users` | `role`, `status`, `search`, `page`, `limit` | Users list (admin) |
| GET | `/users/users/:id` | — | User by ID |
| PUT | `/users/users/:id` | JSON | Update user (admin) |
| POST | `/users/change-password` | `{ currentPassword, newPassword }` | — |
| GET | `/users/activity-logs` | `activityType`, `startDate`, `endDate`, `page`, `limit` | Activity logs |
| POST | `/users/activity-logs` | JSON | Log activity |

### Seed (optional, used by index / inventory-count)
| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| POST | `/seed/initialize` | — | `{ success, results }` |

### Other modules (apiService)

- **Todos:** `GET/POST /todos`, `GET/PUT/DELETE /todos/:id`, `PATCH /todos/:id/status`, `GET /todos/stats`
- **Calendar:** `GET/POST /calendar/events`, `GET /calendar/events/range`, `GET /calendar/events/upcoming`, `GET /calendar/stats`, `GET/PUT/DELETE /calendar/events/:id`, `PATCH /calendar/events/:id/status`
- **Contacts:** `GET/POST /contacts`, `GET/PUT/DELETE /contacts/:id`, `GET /contacts/stats`
- **Chat:** `GET /chat/conversations`, `POST /chat/conversations/direct`, `POST /chat/conversations/group`, `GET/POST /chat/conversations/:id/messages`, `PATCH /chat/conversations/:id/read`, `DELETE /chat/messages/:id`, `GET /chat/unread-count`
- **Email:** `GET/POST /emails`, `GET/PUT/DELETE /emails/:id`, `DELETE /emails/:id/permanent`, `GET /emails/stats`
- **Kanban:** `GET/POST /kanban/boards`, `GET/PUT/DELETE /kanban/boards/:id`, `POST /kanban/boards/:id/columns`, `PUT/DELETE /kanban/columns/:id`, `POST /kanban/boards/:id/cards`, `GET/PUT/DELETE /kanban/cards/:id`, `PATCH /kanban/cards/:id/move`
- **Files:** `GET/POST /files/folders`, `GET/PUT/DELETE /files/folders/:id`, `GET /files`, `GET /files/stats`, `GET/PUT/DELETE /files/:id`, `POST /files/upload`, `POST /files/share`
- **E‑commerce:** `GET/POST /ecommerce/products`, `GET/PUT/DELETE /ecommerce/products/:id`, `GET /ecommerce/categories`, `POST /ecommerce/categories`, `GET/POST /ecommerce/orders`, `GET /ecommerce/orders/:id`, `PUT /ecommerce/orders/:id/status`, `GET /ecommerce/cart`, `POST /ecommerce/cart/items`, `DELETE /ecommerce/cart/items/:id`
- **CRM:** `GET/POST /crm/leads`, `GET/PUT/DELETE /crm/leads/:id`, `GET/POST /crm/deals`, `GET/PUT/DELETE /crm/deals/:id`, `GET/POST /crm/activities`, `GET/PUT /crm/activities/:id`, `GET /crm/stats`
- **Projects:** `GET/POST /projects/projects`, `GET/PUT/DELETE /projects/projects/:id`, `GET /projects/projects/:id/tasks`, `POST /projects/projects/:id/tasks`, `PUT/DELETE /projects/tasks/:id`, `POST /projects/projects/:id/team`, `DELETE /projects/projects/:id/team/:userId`
- **LMS:** `GET/POST /lms/courses`, `GET/PUT/DELETE /lms/courses/:id`, `GET /lms/courses/:id/lessons`, `POST /lms/courses/:id/lessons`, `PUT/DELETE /lms/lessons/:id`, `GET /lms/enrollments`, `POST /lms/courses/:id/enroll`, `PUT /lms/enrollments/:id/progress`, `PUT /lms/enrollments/:id/lessons/:id/progress`
- **Helpdesk:** `GET/POST /helpdesk/tickets`, `GET/PUT/DELETE /helpdesk/tickets/:id`, `POST /helpdesk/tickets/:id/comments`, `GET/POST /helpdesk/agents`, `GET /helpdesk/stats`
- **HR:** `GET/POST /hr/employees`, `GET/PUT /hr/employees/:id`, `GET/POST /hr/attendance`, `GET/POST /hr/leave-requests`, `PUT /hr/leave-requests/:id/status`, `GET/POST /hr/payroll`, `GET/POST /hr/departments`
- **Events:** `GET/POST /events/events`, `GET/PUT/DELETE /events/events/:id`, `POST /events/events/:id/register`, `GET /events/events/:id/registrations`, `POST /events/events/:id/speakers`, `POST /events/events/:id/sessions`
- **Social:** `GET/POST /social/posts`, `GET/PUT/DELETE /social/posts/:id`, `POST /social/posts/:id/like`, `POST /social/posts/:id/comments`, `POST /social/users/:id/follow`, `GET /social/notifications`, `PUT /social/notifications/:id/read`
- **School:** `GET/POST /school/students`, `GET /school/students/:id`, `GET/POST /school/courses`, `POST /school/enrollments`, `POST /school/attendance`, `POST /school/grades`, `GET /school/enrollments/:id/grades`
- **Hospital:** `GET/POST /hospital/patients`, `GET /hospital/patients/:id`, `GET/POST /hospital/appointments`, `POST /hospital/admissions`, `PUT /hospital/admissions/:id/discharge`, `POST /hospital/medications`, `POST /hospital/billing`, `PUT /hospital/billing/:id/payment`
- **Invoices (extra):** `GET /invoices/:id`, `DELETE /invoices/:id`, `GET /invoices/stats`

---

## Phase 2: Page → Data → Endpoints

| Page | Data displayed | Forms / actions | Backend endpoints |
|------|----------------|-----------------|-------------------|
| **index.html** | Dashboard metrics (weekly/monthly loss, food cost %, prime cost, waste %, savings, loss summary, action items, charts, recent activity, savings breakdown modal) | Modal “View breakdown”, init seed if empty | `/dashboard/metrics`, `/dashboard/action-items`, `/seed/initialize`, `/analytics/food-cost` (breakdown), `/invoices`, `/inventory`, `/analytics/suppliers`, `/waste`, `/pos/reports`, `/invoices` |
| **analytics.html** | Waste analysis, product margins, trends, supplier ranking, top waste items, waste by category | Date filters, export | `/dashboard/metrics`, `/dashboard/waste-analysis`, `/analytics/waste-analysis`, `/waste`, `/invoices`, `/pos/reports`, `/dashboard/slow-moving` |
| **reports.html** | Monthly report, product margins, trends, supplier ranking, period comparison, alerts | Month/year, date ranges, compare | `/dashboard/monthly-report`, `/analytics/product-margins`, `/analytics/trends`, `/analytics/suppliers`, `/analytics/compare`, `/analytics/alerts` |
| **basic-elements.html** | Invoice upload, POS upload, waste form, Square sync, “Recently Captured Data” (invoices, POS, waste) | File uploads, waste submit, Square sync | `/invoices/upload`, `/pos/upload`, `/waste` (POST), `/square/sync-today`, `/pos/reports`, `/invoices`, `/waste` |
| **inventory-count.html** | Count sheet items, metrics | Count form submit, init seed | `/inventory/counts/items`, `/inventory/counts` (POST), `/dashboard/metrics`, `/seed/initialize`, `/invoices`, `/inventory`, `/analytics/suppliers`, `/waste`, `/pos/reports`, `/invoices`, `/analytics/food-cost` |
| **products-list.html** | Inventory table (search, CRUD) | Edit modal, delete, add | `/inventory`, `/inventory/:id`, `PUT /inventory/:id`, `DELETE /inventory/:id` |
| **settings.html** | Profile form (name, email, phone, address, country, bio, profession, company, social, etc.) | Save profile | `GET /users/profile`, `PUT /users/profile` |
| **my-profile.html** | Profile view (name, email, role, location, join date, bio, etc.) | — | `GET /users/profile` |
| **sign-in.html** | Login form | Login | `POST /auth/login` |
| **sign-up.html** | Registration form | Register | `POST /auth/register` |

---

## Phase 3: Business Logic

### Formulas (align with `analyticsService`)

- **Food cost %**
  - `foodCostPercent = (totalCostOfGoodsSold / totalSales) * 100`
  - `totalCostOfGoodsSold` = sum of `purchase_items.total_price` (or equivalent) for period; `totalSales` = sum of `sales_items.total_price` for same period.

- **Target food cost**
  - `TARGET_FOOD_COST = 0.28` (28%); target margin 72%.

- **Weekly / monthly loss (difference)**
  - `theoreticalCost = totalSales * 0.28`
  - `actualCost = totalPurchases`
  - `difference = actualCost - theoreticalCost`
  - Positive = over target = loss; negative = under target = gain.
  - `weeklyLoss` / `monthlyLoss` = `|difference|` for display; sign drives “loss” vs “gain”.

- **Savings**
  - `savings = difference` when `difference > 0`, else `0`.

- **Waste**
  - `wasteCost = SUM(waste.cost_value)` for period.
  - `wastePercentage = (wasteCost / totalPurchases) * 100`.

- **Prime cost**
  - `primeCostPercent = foodCostPercent + laborCostPercent` (labor from config or actual data; target band 55–65%).

- **Margin**
  - `margin = salePrice - costPrice`
  - `marginPercent = (margin / salePrice) * 100`

### Business rules

- **Food cost:** Target 28%; alert if > 30% (or as configured).
- **Waste:** Target ≤ 5%; alert if > 5%.
- **Labor:** Target ≤ 30%; prime cost target 55–65%.
- **Low stock:** Alert when `stock < minStock`.
- **Supplier ranking:** By total spend, then rating.
- **Trends:** Compare to previous period.

---

## Phase 4: Authentication & Authorization

### Flow

1. **Login:** `POST /auth/login` → receive `token`, `user`, `tenant`; store in `localStorage` (keys: `restaurant_cost_control_token`, `restaurant_cost_control_user`, `restaurant_cost_control_tenant`).
2. **Register:** `POST /auth/register` → same storage.
3. **Token use:** Send `Authorization: Bearer <token>` on API requests (except login/register).
4. **Validation:** On load, `authHelper` checks token; if invalid/expired, clear storage and redirect to `sign-in.html`.
5. **Refresh:** `GET /auth/me` can refresh user/tenant; token itself is not rotated in current flow.
6. **Logout:** Clear `localStorage`, redirect to `sign-in.html`.

### Auth services

- **authService.js:** `login`, `register`, `getToken`, `getCurrentUser`, `getCurrentTenant`, `isAuthenticated`, `setAuthData`, `clearAuthData`, `logout`, `getCurrentUserInfo` (`/auth/me`), `requireAuth`.
- **authHelper.js:** On load, validate token, redirect if unauthenticated, wire logout links.

### Roles (for future use)

- Admin: full access.
- Manager: edit inventory, view reports.
- Staff: view only, record waste.

---

## Phase 5: File Uploads

### Invoices

- **Accepted:** PDF, Excel, images (e.g. via `accept="image/*,application/pdf"` or equivalent).
- **API:** `POST /invoices/upload`, FormData with `image` (file).
- **Backend:** OCR, extract vendor, date, items, prices; create `purchases` + `purchase_items`; update inventory costs as needed.

### POS reports

- **Accepted:** CSV, Excel, images.
- **API:** `POST /pos/upload`, FormData with `image` (file).
- **Backend:** Parse sales; create `sales` + `sales_items`; update inventory usage.

### Waste images

- **Accepted:** JPG, PNG (optional).
- **API:** `POST /waste` with FormData including `itemName`, `quantity`, `costValue`, `wasteDate`, `reason`, `notes`, and optional `image`.
- **Backend:** Store file path with waste record.

---

## Phase 6: Data Models & Response Shapes

### Core (multi-tenant)

- **User:** `id`, `email`, `password_hash`, `first_name`, `last_name`, `role`, `tenant_id`, `is_active`, `phone`, `address`, `country`, `city`, `state`, `bio`, `profession`, `company_name`, `company_website`, `facebook`, `twitter`, `linkedin`, `youtube`, `skills`, `created_at`, `updated_at`.
- **Tenant:** `id`, `company_name`, `subscription_plan`, `status`, `settings`.
- **Product / Inventory item:** `id`, `item_name`, `quantity`, `unit_price`, `category`, `last_purchase_date`, `last_sale_date`, `expiry_date`, `tenant_id`, `min_stock?`, `sku?`.
- **Invoice / Purchase:** `id`, `vendor`, `purchase_date`, `invoice_number`, `total_amount`, `image_path`, `tenant_id`; **Purchase items:** `purchase_id`, `item_name`, `quantity`, `unit_price`, `total_price`, `category`, `expiry_date`.
- **POS / Sale:** `id`, `report_date`, `total_sales`, `total_transactions`, `average_ticket`, `report_period`, `image_path`, `tenant_id`; **Sales items:** `sale_id`, `item_name`, `quantity`, `unit_price`, `total_price`.
- **Waste:** `id`, `item_name`, `quantity`, `cost_value`, `waste_date`, `reason`, `notes`, `image_path`, `tenant_id`.
- **Inventory count:** `id`, `count_date` (or `countDate`), `items` (JSON), `completed_by`, `tenant_id`.

### Dashboard metrics (representative)

```json
{
  "weeklyLoss": 519.68,
  "monthlyLoss": 519.68,
  "foodCostPercentage": 34.2,
  "primeCostPercent": 67,
  "wasteCost": 4856,
  "wastePercentage": 8.5,
  "savings": 519.68,
  "lossSummary": {
    "theoreticalCost": 1234.56,
    "actualCost": 1754.24,
    "lossAmount": 519.68,
    "lossPercent": 42.1
  },
  "savingsBreakdown": {
    "totalPotentialSavings": 519.68,
    "isLoss": true,
    "summary": { "wasteIssues": 0, "foodCostIssues": 0, "varianceIssues": 0, "inventoryIssues": 0 },
    "calculation": {
      "stepByStep": [...],
      "purchases": [...],
      "totalSales": 0,
      "totalPurchases": 0,
      "expectedPurchases": 0,
      "difference": 519.68
    },
    "items": []
  },
  "foodCostDisplay": { "value": 34.2, "message": "34.2%", "confidence": "full", "tooltip": "...", "dataRequirements": null },
  "wasteDisplay": { "value": 8.5, "message": "8.5%", ... },
  "weeklyLossDisplay": { "label": "Weekly Loss", "isLoss": true },
  "monthlyLossDisplay": { "label": "Monthly Loss", "isLoss": true },
  "lossDefinitions": { "weeklyLoss": "...", "monthlyLoss": "..." }
}
```

### “Recently Captured Data” (basic-elements, index, etc.)

- **POS:** `GET /pos/reports` → array-like list. Each: `report_date`, `total_sales`, etc.
- **Invoices:** `GET /invoices` → array-like list. Each: `purchase_date`, `vendor`, `invoice_number`, `total_amount`.
- **Waste:** `GET /waste` → array-like list. Each: `waste_date`, `item_name`, `reason`, `cost_value`.

Frontend normalizes with:

- `invoices = res?.data?.invoices || res?.data || res || []`
- `Array.isArray(invoices) ? invoices : []`

Backend should return arrays (or `data.invoices` / `data.reports` / `data.wasteRecords`) so that `.slice()` and iteration always work.

---

## API Base URL & CORS

- **Base URL:** `window.APP_CONFIG.API_BASE_URL` or, in dev, `http://localhost:8000/api`.
- **CORS:** Allow `http://localhost:3000`, `http://localhost:8080`, `http://127.0.0.1:3000` (and prod origins as configured).

---

## Frontend Files Reference

| File | Role |
|------|------|
| `fila/assets/js/api/apiService.js` | All API calls |
| `fila/assets/js/auth/authService.js` | Login, register, token, /me |
| `fila/assets/js/auth/authHelper.js` | Auth check on load, logout links |
| `fila/assets/js/config.js` | `APP_CONFIG`, `API_BASE_URL` |
| `fila/index.html` | Dashboard, metrics, action items, breakdown, seed |
| `fila/analytics.html` | Waste, margins, trends, suppliers |
| `fila/reports.html` | Monthly report, margins, trends, compare, alerts |
| `fila/basic-elements.html` | Invoices, POS, waste, Square sync, recent captures |
| `fila/inventory-count.html` | Count sheet, submit count |
| `fila/products-list.html` | Inventory CRUD |
| `fila/settings.html` | Profile load/save |
| `fila/my-profile.html` | Profile display |
| `fila/sign-in.html`, `fila/sign-up.html` | Login, register |

---

## Checklist for Backend Implementation

- [ ] Auth: `POST /auth/login`, `POST /auth/register`, `GET /auth/me`; JWT; 401 → clear token & redirect.
- [ ] Dashboard: `GET /dashboard/metrics` (including `savingsBreakdown`, `lossSummary`, `foodCostDisplay`, etc.), `GET /dashboard/action-items`, `GET /dashboard/monthly-report`, `GET /dashboard/waste-analysis`, `GET /dashboard/slow-moving`.
- [ ] Analytics: `GET /analytics/food-cost`, `product-margins`, `trends`, `suppliers`, `compare`, `alerts`, `waste-analysis`.
- [ ] POS: `GET /pos/reports`, `POST /pos/upload`.
- [ ] Invoices: `GET /invoices`, `POST /invoices/upload`.
- [ ] Waste: `GET /waste`, `POST /waste` (FormData with optional image).
- [ ] Square: `POST /square/sync-today` (and other Square endpoints if used).
- [ ] Inventory: CRUD, `GET /inventory/counts/items`, `POST /inventory/counts`.
- [ ] Users: `GET /users/profile`, `PUT /users/profile`.
- [ ] Seed: `POST /seed/initialize` (optional).
- [ ] All list endpoints return arrays or `data.*` arrays so frontend never calls `.slice` on non-arrays.
- [ ] Business logic matches Phase 3 (food cost 28%, loss = actual − theoretical, waste %, prime cost, etc.).

Use this spec to implement missing routes, align responses with the frontend, and keep backend and UI in sync.
