# Cloudignite — Development Guide

Setup, conventions, and workflows for developers.

---

## 1. Repo structure

- **backend/** — Node.js API (Express, SQLite, JWT, multi-tenant).
- **fila/** — Static frontend (HTML/JS/CSS); Cloudignite app pages + template demos.
- **docs/** — Operations, specs, refactor plans.
- **.github/workflows/** — CI/CD (test, security, build, deploy).

---

## 2. Prerequisites

- Node.js 18.x
- npm (or compatible)

---

## 3. Local setup

```bash
# Clone and install
git clone <repo>
cd backend && npm install
cp .env.example .env   # Edit .env (JWT_SECRET, etc.)

# DB and migrations
npm run migrate

# Start backend
npm start
# Or with auto-reload:
npm run dev
```

From repo root you can use:

- `./start-all.sh` — backend + frontend
- `./run-tests.sh` — full test suite (backend must be running)
- `./reset-demo.sh` — demo user + seed data

---

## 4. Env and config

- **backend/.env:** Copy from `.env.example`. Required: `JWT_SECRET`, `DATABASE_PATH`, `NODE_ENV`, `ALLOWED_ORIGINS`.
- **Frontend:** Set `API_BASE_URL` (e.g. in config or build) to backend URL (e.g. `http://localhost:8000`).

---

## 5. Running tests

From `backend/`:

| Command | Description |
|---------|-------------|
| `npm run test:all` | Auth, compatibility, modules, endpoints, smoke (used in CI) |
| `npm run test:auth` | Auth flow tests |
| `npm run test:modules` | Module loading |
| `npm run test:endpoints` | API endpoint smoke |
| `npm run test:smoke-e2e` | E2E smoke |
| `npm run test:db-integrity` | DB integrity checks |

CI fails the build if `npm run test:all` fails.

---

## 6. Codebase highlights

- **Routes:** `backend/src/routes/` (dashboard, analytics, auth, inventory, etc.).
- **Services:** `backend/src/services/` — core logic (e.g. `analyticsService.js`). Analytics modules in `analytics/`: `periodService.js` (reporting periods), `profitabilityService.js` (same-period P&L), `foodCostService.js`, `wasteAnalysisService.js`. See `docs/ANALYTICS_REFACTOR_PLAN.md` for full split.
- **DB:** SQLite via `backend/src/config/database.js`; migrations in `backend/database/migrations/` or `scripts/run-migrations.js`.
- **Auth:** JWT; tenant from token or header; see `backend/src/middleware/auth.js`.

---

## 7. Conventions

- **API responses:** Use shared response helpers (e.g. success/error shape) for consistency.
- **Tenant scope:** All tenant-scoped queries must filter by `tenant_id`.
- **Dates:** Use `date-fns` and ISO date strings for range queries.
- **New features:** Prefer extending existing services/routes; for large changes see refactor plan and Owner Dashboard spec in `docs/`.

---

## 8. Documentation

- **API:** `API_ENDPOINTS_REFERENCE.md`, `API_QUICK_REFERENCE.md`, `API_QUICK_START.md`.
- **Deploy:** `deploy-guide.md`, `backend/DEPLOYMENT_CHECKLIST.md`.
- **Operations:** `docs/OPERATIONS.md`.
- **Analytics refactor:** `docs/ANALYTICS_REFACTOR_PLAN.md`.
- **Owner dashboard:** `docs/OWNER_DASHBOARD_MVP_SPEC.md`.
- **Fila HTML:** `docs/FILA_HTML_CATEGORIZATION.md` (categorization and cleanup plan).
- **Feature flags:** `docs/FEATURE_FLAG_DESIGN.md` (safe rollout, e.g. Owner View `ENABLE_OWNER_VIEW`).
- **Status:** `IMPLEMENTATION_STATUS.md` (what’s done vs deferred).
