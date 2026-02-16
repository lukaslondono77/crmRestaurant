# Frontend–Backend Connection Setup

This document describes the connection fixes and tools added so the frontend correctly talks to the backend.

---

## 1. Configuration

### Frontend

- **`fila/assets/js/config.js`**
  - Sets `window.APP_CONFIG.API_BASE_URL` to `http://localhost:8000/api` in development.
  - Load `config.js` before `apiService` on pages that use the API (e.g. `index.html`, `inventory-count.html`).

- **`fila/assets/js/api/apiService.js`**
  - Exposes `apiService.API_BASE_URL` for use in seed and other calls.

### Backend

- **CORS** (`backend/src/server.js`)
  - Allows `http://localhost:3000`, `http://localhost:8080`, `http://127.0.0.1:3000`.
  - `credentials: true`, common methods and headers.
  - Optional: set `ALLOWED_ORIGINS` in `.env` for production.

---

## 2. Seed / Initialize

### Authenticated seed

- **`POST /api/seed/initialize`** requires a valid JWT (`Authorization: Bearer <token>`).
- Dashboard and inventory-count call it when metrics are empty, using the current user’s token and `API_BASE_URL`.

### Frontend seed calls

- **`fila/index.html`** and **`fila/inventory-count.html`**:
  - Use `(window.apiService?.API_BASE_URL) || (window.APP_CONFIG?.API_BASE_URL) || 'http://localhost:8000/api'`.
  - Send `Authorization: Bearer <token>` when calling `/seed/initialize`.
  - Load `config.js` before `apiService`.

### Apps/Pages demo data

- **`backend/scripts/seed-all-modules.js`**
  - Seeds todos, calendar_events, contacts for the first tenant/user.
  - Run: `cd backend && npm run seed:modules`
  - Optional env: `TENANT_ID`, `USER_ID`.

- **`POST /api/seed/initialize`** (existing)
  - Seeds Cloudignite data (purchases, sales, waste, inventory) for the authenticated tenant.

---

## 3. Scripts and Tools

| Script | Command | Purpose |
|--------|--------|---------|
| Auth flow | `npm run test:auth` | Register → token → `/auth/me` |
| Compatibility | `npm run test:compatibility` | Invoices/POS/waste arrays, dashboard metrics, Square sync |
| All modules | `npm run test:modules` | Hits dashboard, inventory, waste, todos, calendar, etc. |
| Smoke E2E | `npm run test:smoke-e2e` | Register → seed (best-effort) → dashboard → inventory → todos |
| **All tests** | `npm run test:all` | Runs auth + compatibility + modules + endpoints + smoke (backend must be up) |
| Seed modules | `npm run seed:modules` | Todos, calendar, contacts demo data |
| Start dev | `./start-dev.sh` | Start backend + frontend (ports 8000, 3000) |

---

## 4. Diagnostic Page

- **`fila/diagnose-connection.html`**
  - Run with frontend on **:3000** and backend on **:8000**.
  - Open: `http://localhost:3000/diagnose-connection.html`.
  - Clicks “Run diagnostics” to check:
    - Backend reachable
    - CORS / fetch from frontend origin
    - Database connected (`/api/healthz?detailed=1`)

---

## 5. Quick Start

```bash
# 1. Backend
cd backend
npm install
npm run migrate
npm start
# Or: npm run dev

# 2. Frontend (another terminal)
cd fila
python3 server.py

# 3. Optional: seed Apps/Pages demo data
cd backend && npm run seed:modules

# 4. Or use start-dev.sh (backend + frontend)
./start-dev.sh
```

Then:

1. Open `http://localhost:3000`.
2. Sign up / log in.
3. Dashboard will call `/seed/initialize` when metrics are empty (with your token).
4. Run diagnostics: `http://localhost:3000/diagnose-connection.html`.

---

## 6. Manual E2E Checklist (browser)

With backend on **:8000** and frontend on **:3000**:

1. **Login** – Open `http://localhost:3000`, go to sign-in, log in (or register).
2. **Dashboard** – Metrics load, no “Loading…” forever. If empty, seed runs automatically (check console).
3. **Diagnostic** – Open `http://localhost:3000/diagnose-connection.html`, click “Run diagnostics”; all checks pass.
4. **To Do** – Open To Do List from sidebar; list loads (may be empty).
5. **Calendar** – Open Calendar; events load or empty state.
6. **Contacts** – Open Contacts; list loads or empty state.
7. **Inventory** – Open Inventory Control / Products; list loads or “Upload invoices” message.
8. **Manual Data Entry** – Invoices, POS, Waste tabs load without errors.

**Diagnostic done?** Next: **Login** → **Dashboard** → **To Do** → **Calendar** → **Contacts** → **Inventory** → **Manual Data Entry**. Use the sidebar; each page should load without console errors. Direct links: `sign-in.html`, `index.html`, `calendar.html`, `contacts.html`, `products-list.html`, `basic-elements.html`.

---

## 7. Troubleshooting

| Symptom | Check |
|--------|--------|
| “Backend not running” | Backend on **:8000**; `curl http://localhost:8000/api/healthz` |
| CORS errors | Backend CORS allows `http://localhost:3000`; frontend served from that origin |
| Seed fails / 401 | User logged in; seed request includes `Authorization: Bearer <token>` |
| “No data” on dashboard | Run `POST /api/seed/initialize` (via UI when metrics empty) or ensure DB has data |
| “No data” on Apps/Pages | Run `npm run seed:modules` in `backend` |
| Seed fails with UNIQUE / SQLITE_CONSTRAINT | Fixed: seed uses upsert + fallback UPDATE for inventory. Restart backend and retry. |

---

## 8. Backend Fixes (Apps/Pages Modules)

- **`backend/src/utils/pagination.js`** – `parsePaginationParams` now accepts either `req` (uses `req.query`) or a `filters` object with `page`/`limit`, so services can pass filters directly.
- **`backend/src/services/todoService.js`**, **calendarService.js**, **contactService.js**, **emailService.js**, **kanbanService.js**, **fileManagerService.js** (getFolders) – All list queries use **qualified column names** (e.g. `t.tenant_id`, `e.tenant_id`) in `WHERE` and count queries to avoid “ambiguous column name: tenant_id” when joining with `users`.

## 9. File Changes Summary

- **`backend/src/routes/seedRoutes.js`** – Seed inventory upsert: `INSERT ... ON CONFLICT(tenant_id, item_name) DO UPDATE` uses `excluded.*`; on UNIQUE/SQLITE_CONSTRAINT error, fallback `UPDATE inventory` so seed no longer fails when the same item appears across purchases or when re-seeding.
- **`fila/assets/js/config.js`** – Log config in dev; `API_BASE_URL` for dev/prod.
- **`fila/assets/js/api/apiService.js`** – `apiService.API_BASE_URL` exposed.
- **`fila/index.html`** – `config.js` added; seed uses base URL + token.
- **`fila/inventory-count.html`** – Same seed + config changes.
- **`fila/diagnose-connection.html`** – New diagnostic page.
- **`backend/scripts/test-auth-flow.js`** – New auth flow test.
- **`backend/scripts/test-all-modules.js`** – New module connection test.
- **`backend/scripts/seed-all-modules.js`** – New Apps/Pages seed script.
- **`backend/scripts/smoke-e2e.js`** – New smoke E2E script (register → seed → dashboard → inventory → todos).
- **`backend/package.json`** – `test:auth`, `test:modules`, `test:smoke-e2e`, `seed:modules` scripts.
- **`start-dev.sh`** – New script to start backend + frontend.
