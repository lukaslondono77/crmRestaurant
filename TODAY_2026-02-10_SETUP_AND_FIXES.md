# Session Log - 2026-02-10

This file documents what was done today to get the project running locally, fix runtime issues, and standardize startup.

For a senior-level production readiness summary and hardening status, see:

- `DAILY_ENGINEERING_LOG_2026-02-10.md`

## Environment and local setup completed

- Installed Python 3.12 (via `winget`) for optional frontend serving.
- Installed Node.js LTS (includes `npm`) via `winget`.
- Created local backend env file: `backend/.env`.
- Added local startup/helper scripts:
  - `start-dev.ps1` (starts backend + frontend in separate windows)
  - `setup-missing.ps1` (installs deps, prepares DB)
  - `install-python.ps1` (Python installer helper)
  - `install-and-setup.ps1` (Node + project setup helper)
  - `run-one-server.bat` (single-command local run path)
  - `RUN_APP.md` (quick local run instructions)

## Backend/frontend run path standardized

- Backend now serves frontend static files (`fila`) directly from `backend/src/server.js`.
- Root route now redirects to app:
  - `/` -> `/core/index.html`
- Main local URL:
  - `http://localhost:8000/core/index.html`

## Fixes applied

### 1) CORS login issue

- Problem: `Not allowed by CORS` when logging in from `http://localhost:8000`.
- Fix: added `localhost:8000` and `127.0.0.1:8000` to allowed origins in `backend/src/server.js`.
- Result: login requests succeed from same-origin frontend.

### 2) Database schema mismatch (`tenant_id` missing)

- Problem: many API 500 errors (`SQLITE_ERROR: no such column: tenant_id`).
- Root causes:
  - migration runner executed migrations in parallel (race/order issues),
  - schema in existing DB lacked tenant columns on core tables.
- Fixes:
  - updated `backend/scripts/run-migrations.js` to run migrations sequentially,
  - added `backend/scripts/repair-tenant-schema.js` to safely add missing `tenant_id` columns and indexes.
- Repair executed successfully for:
  - `purchases`, `purchase_items`, `sales`, `sales_items`, `waste` (added),
  - `inventory` (already present).
- Result: previously failing endpoints now return `200`.

### 3) Square integration noise without credentials

- Problem: repeated Square auth/location warnings in logs when creds not configured.
- Fixes:
  - `backend/src/services/squareService.js` now short-circuits to simulated data if Square config is missing,
  - `backend/.env` includes `ENABLE_SQUARE_SYNC=false` for local dev.
- Result: no unnecessary Square auth errors in normal local flow.

### 4) CSP font warnings

- Problem: Google Fonts blocked by CSP.
- Fix: updated `backend/src/middleware/security.js` CSP:
  - allow `https://fonts.googleapis.com` in `style-src`,
  - allow `https://fonts.gstatic.com` in `font-src`.

## Test user credentials created

- Email: `admin@test.com`
- Password: `admin123`
- Company: `Test Restaurant`

## How to start the program (recommended)

### Option A (easiest)

1. Double-click `run-one-server.bat`
2. Open:
   - `http://localhost:8000/core/index.html`

### Option B (terminal)

```powershell
cd "c:\Users\lukas\OneDrive\Desktop\crmRestaurant-main\backend"
npm install
npm start
```

Then open:

- `http://localhost:8000/core/index.html`

## Optional two-server mode

- Use `start-dev.ps1` to run:
  - backend on `8000`
  - frontend on `3000` (Python if available, otherwise Node-based static server)

## Notes

- If UI shows stale errors, hard refresh with `Ctrl+F5`.
- For first-time setup on a new machine:
  - run `install-and-setup.ps1`, then `run-one-server.bat`.
