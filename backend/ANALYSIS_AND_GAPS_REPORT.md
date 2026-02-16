# Backend analysis & gaps report — Cloudignite Cost Control

## STEP 1: Current state

### 1.1 Database schema (relevant tables)

**Base (`schema.sql`):**
- `purchases` — vendor, purchase_date, invoice_number, total_amount, image_path
- `purchase_items` — purchase_id, item_name, quantity, unit_price, total_price, category, expiry_date
- `sales` — report_date, total_sales, total_transactions, average_ticket, report_period, image_path
- `sales_items` — sale_id, item_name, quantity, unit_price, total_price
- `waste` — item_name, quantity, cost_value, waste_date, reason, notes, image_path
- `inventory` — item_name, quantity, unit_price, category, last_purchase_date, last_sale_date, expiry_date, **tenant_id**

**Multi-tenant (`run-migration.js` + migration 001):**
- `tenants` — company_name, subscription_plan, subscription_status, trial_ends_at, square_*
- `users` — tenant_id, email, password_hash, first_name, last_name, role, is_active
- `tenant_id` added to: **purchases, purchase_items, sales, sales_items, waste, inventory**

**Migrations 002–021:** todos, calendar_events, contacts, chat, emails, kanban, file manager, ecommerce, CRM, projects, LMS, helpdesk, HR, events, social, user_profile, school, hospital, performance indexes, inventory_counts.

---

### 1.2 Frontend-required endpoints vs backend

| Frontend call | Backend route | Status |
|---------------|----------------|--------|
| **Auth** | | |
| POST /api/auth/login | ✅ POST /api/auth/login | OK |
| POST /api/auth/register | ✅ POST /api/auth/register | OK |
| GET /api/auth/me | ✅ GET /api/auth/me | OK |
| **Dashboard** | | |
| GET /api/dashboard/metrics | ✅ GET /api/dashboard/metrics | OK |
| GET /api/dashboard/action-items | ✅ GET /api/dashboard/action-items | OK |
| GET /api/dashboard/monthly-report | ✅ GET /api/dashboard/monthly-report | OK |
| **Inventory** | | |
| GET /api/inventory | ✅ GET /api/inventory | OK |
| GET /api/inventory/:id | ✅ GET /api/inventory/:id | OK |
| PUT /api/inventory/:id | ✅ PUT /api/inventory/:id | OK |
| GET /api/inventory/counts/items | ✅ GET /api/inventory/counts/items | OK |
| POST /api/inventory/counts | ✅ POST /api/inventory/counts | OK |
| **Analytics** | | |
| GET /api/analytics/waste-analysis | ✅ GET /api/analytics/waste-analysis | OK |
| GET /api/analytics/product-margins | ✅ GET /api/analytics/product-margins | OK |
| GET /api/analytics/trends | ✅ GET /api/analytics/trends | OK |
| GET /api/analytics/supplier-ranking | Frontend uses GET /api/analytics/suppliers | OK (same) |
| POST /api/analytics/compare-periods | Frontend uses GET /api/analytics/compare?period1Start=... | OK |
| GET /api/analytics/alerts | ✅ GET /api/analytics/alerts | OK |
| **Operations** | | |
| POST /api/invoices/upload | ✅ POST /api/invoices/upload | OK |
| POST /api/pos/upload | ✅ POST /api/pos/upload | OK |
| POST /api/waste | ✅ POST /api/waste | OK |
| POST /api/square/sync | Frontend uses POST /api/square/sync-today | OK (sync-today exists) |

All required endpoints exist.

---

### 1.3 Auth middleware (`auth.js`)

- **`authenticate`:** Reads `Authorization: Bearer <token>`, verifies JWT, loads user (+ tenant), checks active and subscription. Sets `req.user` = `{ id, tenantId, email, role, subscriptionPlan }`. Returns 401 on missing/invalid/expired token.
- **`tenantFilter`:** Requires `req.user` and `req.user.tenantId`; sets `req.tenantId = req.user.tenantId` and calls `next()`. Returns 401 otherwise.
- **`authorize(...roles)`:** Restricts by `req.user.role`.

JWT auth and tenant isolation are implemented.

---

### 1.4 Multi-tenant isolation

- **Dashboard, analytics, inventory, invoices, POS, waste:** Use `authenticate` + `tenantFilter`; queries use `req.tenantId` (e.g. `WHERE tenant_id = ?`).
- **Auth routes:** No tenant filter (login/register). GET /me uses `authenticate` only.

---

### 1.5 File uploads

- **Invoices:** Multer → `uploads/invoices`, OCR → `purchases` + `purchase_items` + inventory upsert. `tenant_id` set.
- **POS:** Multer → `uploads/pos`, OCR → `sales` + `sales_items`, inventory update. `tenant_id` set.
- **Waste:** Multer (optional image) → `uploads/waste`, insert into `waste`, inventory update. `tenant_id` set.

---

### 1.6 Immediate gaps / fixes to apply

1. **Dashboard metrics shape:** Prompt expects `foodCostPercent`, `primeCostPercent`, `wasteCost`, `savings`, `lossSummary`. Current `getDashboardMetrics` returns a richer, different shape. Frontend uses the current one. We will **add** these fields to the metrics response so both the prompt spec and frontend are satisfied.
2. **Square sync alias:** Prompt says POST /api/square/sync. Frontend uses `/sync-today`. Add **POST /api/square/sync** as an alias to sync-today for consistency.
3. **`tenantFilter`:** Add explicit `return next()` on success path (no logic change, clarity only).
4. **Auth response shape:** Already `{ success: true, data: { token, user, tenant } }`. Matches frontend. No change.
5. **Inventory GET /:id:** Uses `pi.tenant_id` and `si.tenant_id`. Those columns exist after `run-migration.js`. No change unless we see errors.

---

### 1.7 Summary

- **Working:** Auth (login, register, me), dashboard (metrics, action-items, monthly-report), inventory CRUD + counts, analytics endpoints, invoices/POS/waste uploads, Square sync-today. JWT and tenant filtering in place. File uploads and tenant_id usage are correct.
- **Applied:** Prompt-style metrics fields (`foodCostPercent`, `primeCostPercent`, `wasteCost`, `savings`, `lossSummary`), POST `/api/square/sync` alias, `tenantFilter` `return next()` cleanup.

---

## 2. Verification (curl examples)

Ensure backend is running (`cd backend && npm run dev`), then:

```bash
# Health
curl -s http://localhost:8000/api/healthz | jq .

# Register
curl -s -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"companyName":"Test Co","email":"test@example.com","password":"password123","firstName":"Test","lastName":"User"}' | jq .

# Login (use token from register or login)
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}' | jq -r '.data.token')
echo "Token: ${TOKEN:0:50}..."

# Auth me
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/auth/me | jq .

# Dashboard metrics (includes foodCostPercent, primeCostPercent, wasteCost, savings, lossSummary)
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:8000/api/dashboard/metrics" | jq .

# Inventory list
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:8000/api/inventory" | jq .
```

**DB setup:** Run `node database/run-migration.js` (adds `tenant_id` to purchases, purchase_items, sales, sales_items, waste, inventory) then `npm run migrate` for remaining migrations. Ensure `restaurant_cost.db` exists (from `database/init.js` or migrations).
