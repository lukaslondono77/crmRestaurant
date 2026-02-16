# Pre-Production Execution Plan — Validation & Step-by-Step

**Companion to:** `PRE_PRODUCTION_READINESS.md`  
**Purpose:** Confirm correctness of the readiness doc, convert it into an executable plan (P0/P1/P2), define “done” for staging, and state risk-based gates.

---

## Part 1 — Validation of the Readiness Document

### Correctness

| Item | Verdict | Notes |
|------|--------|--------|
| **Blocker 1 (JWT fallback)** | **Accurate** | `authRoutes.js` lines 57 and 141 use `process.env.JWT_SECRET \|\| 'your-secret-key-change-in-production'`. `config/env.js` does require `JWT_SECRET` and exits, but the fallback is still a latent bug if env is ever loaded differently or a copy-paste bypasses validation. Must remove fallback. |
| **Blocker 2 (Public /uploads)** | **Accurate** | `server.js` line 64: `app.use('/uploads', express.static(...))` with no auth. No authenticated download route exists; file manager and other routes write under `uploads/` but reads are public. |
| **Blocker 3 (Path traversal)** | **Accurate** | `fileManagerService.js`: `folderPath = name` and `folderPath = parent.path + '/' + name` then `path.join(uploadsDir, tenantId, folderPath)`. No sanitization of `name` or validation of `parent.path`. |
| **Blocker 4 (Unsafe JSON.parse)** | **Accurate** | `fileManagerRoutes.js` line 133: `tags: req.body.tags ? JSON.parse(req.body.tags) : null` with no try/catch. |
| **Blocker 5 (CORS no-origin)** | **Accurate** | `server.js` 18–21: when `!origin` callback(null, true). With credentials, this is riskier in staging/prod. |
| **Blocker 6 (No CI test gate)** | **Accurate** | `ci-cd.yml` has security → build → deploy; no job runs `npm test` or `test:all` before build. |
| **DATABASE_PATH** | **Accurate** | `backend/src/config/database.js` line 4 uses hardcoded path; no `process.env.DATABASE_PATH`. |
| **Migrations** | **Accurate** | `run-migrations.js` runs migrations sequentially but has no ledger table; re-runs re-apply all. Idempotency relies on `IF NOT EXISTS` in SQL. |
| **Rate limiters** | **Accurate** | `rateLimiters.upload` and `rateLimiters.api` exist in security.js but are not applied in server.js or file routes. |

### What Is Missing or Understated

- **Multer before tenantFilter:** In `fileManagerRoutes.js`, multer’s `destination` uses `req.tenantId || 'default'`. Middleware order is `authenticate, tenantFilter, upload.single('file')`, so `tenantId` is set before upload. Not a blocker; document is correct to not list it as such. Optional P2: assert tenantId in upload handler and reject if still `default`.
- **NODE_ENV=staging:** The app treats only `development` and `production` explicitly. For staging, treat as production-like (require `ALLOWED_ORIGINS`, reject no-origin). Either set `NODE_ENV=production` for staging or add explicit `staging` handling in CORS and env validation. Execution plan will assume “staging = production-like” for security.
- **Health endpoint sensitivity:** `/api/healthz?detailed=1` returns `memory: process.memoryUsage()`. Not a blocker for staging but should not expose in public prod; call out in P2 or operations doc.
- **auth.js JWT:** `middleware/auth.js` uses `process.env.JWT_SECRET` without fallback for verify. So only authRoutes signing is at risk; blocker description is correct.

### What Is Overstated or Can Be Deferred

- **Migration ledger:** Important for production and repeatable deploys. For staging, sequential run + idempotent SQL is *acceptable* if migrations are append-only and never modified. P1 is enough; P0 is not required for “safe to deploy once.”
- **Structured logging everywhere:** Replacing all console.* is P2. For staging gate, audit persistence (P1) and one structured log path for auth/sensitive ops is enough; full rollout can wait for production.
- **Real unit test suite:** CI gate can be satisfied by running existing script-based tests (`test:auth`, `test:smoke-e2e`, etc.) in CI. Full Jest/Vitest unit suite is P2 for staging.

### Prioritization

- The six blockers are correctly P0; no change.
- “Require ALLOWED_ORIGINS in non-dev” and “Frontend API base URL” are correctly required for staging (P0/P1) so staging URL works and CORS is strict.
- “Migration ledger” and “Backup before migrate” are correctly P1 for stable staging; not P0 for first staging deploy if you accept one-time migration risk.
- “Role checks on user routes” is P1 (required for stable staging with real users), not P0, unless staging will host sensitive user data immediately.

---

## Part 2 — Concrete Enhancement Plan

### P0 — Must-Fix Before Staging (Blockers)

Deploy to staging is **blocked** until all P0 items are done.

| Step | Action | File(s) | Done criteria |
|------|--------|---------|----------------|
| P0.1 | Remove JWT fallback | `backend/src/routes/authRoutes.js` | Use only `process.env.JWT_SECRET` for both `jwt.sign` calls (register + login). No `\|\| '...'`. Add inline guard: if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET required') before sign (defense in depth). |
| P0.2 | Stop serving /uploads as public static | `backend/src/server.js` | Remove line 64 (`app.use('/uploads', express.static(...))`). Add authenticated download route: e.g. `GET /api/files/download/:fileId` with `authenticate`, `tenantFilter`, resolve file path from DB by fileId + tenantId, validate path is under uploads dir and belongs to tenant, then `res.sendFile`. Ensure all frontend references to `/uploads/...` switch to the new API or use a query param token (prefer API). |
| P0.3 | Sanitize folder name and path | `backend/src/services/fileManagerService.js` | In `createFolder`: sanitize `name` (reject or strip `..`, `/`, `\`, null bytes, and trim). Validate `parent.path` from DB does not contain `..`; if it does, treat as invalid. Build `folderPath` only from sanitized segments. Normalize path before `path.join`. |
| P0.4 | Safe JSON for tags in upload | `backend/src/routes/fileManagerRoutes.js` | Replace `tags: req.body.tags ? JSON.parse(req.body.tags) : null` with try/catch; on parse error set tags to null or return 400 with clear message. Optionally validate that parsed value is array of strings. |
| P0.5 | CORS: reject no-origin in non-development | `backend/src/server.js` | In corsOptions.origin: when `!origin`, if `process.env.NODE_ENV === 'production'` (or `=== 'staging'` if you add it), return `callback(new Error('Origin required'))`. Otherwise allow (development). |
| P0.6 | CI test gate | `.github/workflows/ci-cd.yml` | Add job `test` (or extend security job): `working-directory: backend`, run `npm ci`, then `npm run test:all` (or at minimum `npm run test:auth` and `npm run test:smoke-e2e` if test:all is heavy). Fail pipeline on failure. Make `build` job `needs: [security, test]`. |

**Guardrails**

- After P0.1: Start server without `JWT_SECRET` in env; must exit (env.js already does this; confirm authRoutes has no fallback).
- After P0.2: Request to `GET /uploads/files/1/anything` returns 404 or 401; only authenticated download route serves files.
- After P0.3: Create folder with name `../../../etc` fails or is stored as safe segment; no file created outside uploads.
- After P0.4: Upload with `tags: "invalid"` returns 400 or stores null; no 500.
- After P0.5: With `NODE_ENV=production`, request with no Origin header is rejected by CORS.
- After P0.6: Push that breaks test:auth or smoke test fails the pipeline before build.

---

### P1 — Required for Stable Staging

Required before treating staging as “production-like” with real users or sensitive data.

| Step | Action | File(s) | Done criteria |
|------|--------|---------|----------------|
| P1.1 | Apply API and upload rate limiters | `backend/src/server.js`, `backend/src/routes/fileManagerRoutes.js` | Mount `rateLimiters.api` on `/api` (before route includes). On fileManagerRoutes `POST /upload`, add `rateLimiters.upload` before `authenticate`. |
| P1.2 | Require ALLOWED_ORIGINS in non-dev | `backend/src/config/env.js` | When `NODE_ENV` is `production` (and optionally `staging`), add validation: if `!process.env.ALLOWED_ORIGINS` or empty, push to errors and exit. Document in .env.example. |
| P1.3 | Frontend API base URL configurable | `fila/assets/js/auth/authService.js` | Replace hardcoded `http://localhost:8000` in login, register, getCurrentUserInfo with same source as apiService (e.g. `window.APP_CONFIG?.API_BASE_URL` or relative `/api` when same origin). |
| P1.4 | User routes role check | `backend/src/routes/userRoutes.js` | Add `authorize('admin')` (or equivalent) to list/get user endpoints so only admins can list or read other users. Implement or reuse middleware that checks `req.user.role`. |
| P1.5 | DATABASE_PATH from env | `backend/src/config/database.js` | Use `process.env.DATABASE_PATH || path.join(__dirname, '../../database/restaurant_cost.db')`. Resolve relative to cwd or __dirname consistently. Document in .env.example. |
| P1.6 | Startup: DB and uploads dir | `backend/src/server.js` or a small startup script | After DB connect, run `db.getAsync('SELECT 1')`; on failure exit(1). Ensure `uploads` (and `uploads/files`) exist and are writable; if not, exit(1). Optional: in non-dev, require ALLOWED_ORIGINS before listening. |
| P1.7 | Staging deploy and smoke test | `.github/workflows/ci-cd.yml` | Replace staging placeholder with real deploy (e.g. SSH + docker pull + compose up). After deploy, run smoke test (health + login + one protected endpoint); fail job on failure. Use `vars.STAGING_URL` and require it for deploy to run. |

**Guardrails**

- P1.2: Start with NODE_ENV=production and no ALLOWED_ORIGINS; server must exit with clear message.
- P1.6: Remove write permission from uploads dir; server must fail to start.

---

### P2 — Nice-to-Have for Staging (Can Wait Until Production)

| Step | Action | Notes |
|------|--------|--------|
| P2.1 | Migration ledger table | `backend/scripts/run-migrations.js`, new migration | Table `schema_migrations` (id, name, applied_at). Run only migrations not in table; insert after each. Enables safe re-runs and rollback awareness. |
| P2.2 | Backup before migrate in CI | Deploy step or script | Run `node scripts/backup-database.js create` (or equivalent) before `npm run migrate` in deploy. |
| P2.3 | Structured logging (full) | New logger, then backend/src | Replace console.* with structured logger; request id and tenant id in context. Can be phased; start with auth and file routes. |
| P2.4 | Audit log persistence | `backend/src/middleware/security.js` | Write audit entries to file or external sink instead of console only. |
| P2.5 | ENABLE_METRICS and metrics on | `backend/src/utils/featureFlags.js`, `backend/src/middleware/metrics.js` | Add ENABLE_METRICS to flags; default true for staging/production. Ensure metrics middleware does not no-op. |
| P2.6 | Unit test suite (Jest/Vitest) | `backend/package.json`, tests | Replace placeholder `npm test` with real runner; add unit tests for auth and tenant filtering. Complements existing script-based tests. |
| P2.7 | Health detailed sensitivity | `backend/src/server.js` | In production, do not expose `memory` or verbose details in `?detailed=1`; or restrict to internal only. |
| P2.8 | RUNBOOK.md | Repo root | Document deploy, rollback, backup/restore, required secrets and vars. |

---

## Part 3 — Definition of “Done” for Pre-Production

**Minimum to safely deploy to staging:**

1. **All P0 items are implemented and verified** (no JWT fallback, no public uploads, path sanitization, safe JSON parse, CORS strict in non-dev, CI test gate).
2. **Staging runs with production-like security:** `NODE_ENV=production` (or explicit staging handling), `ALLOWED_ORIGINS` set to staging frontend URL only, no localhost in CORS for staging.
3. **Secrets:** `JWT_SECRET` (and any Square/other keys if used) injected via environment/secrets store, not committed.
4. **One successful deploy to staging** using the real CI deploy step and a passing smoke test after deploy.
5. **Startup fail-fast:** Server exits if JWT_SECRET missing, DB unreachable, or (with P1) uploads dir not writable / ALLOWED_ORIGINS missing in prod mode.

**Can wait until production (do not block staging):**

- Full migration ledger and backup-before-migrate in pipeline (P2); acceptable to run migrations once manually or with current script for first staging deploy.
- Full structured logging and audit persistence (P2); console audit and basic health are enough for staging.
- Full unit test suite (P2); script-based tests in CI are enough for staging gate.
- RUNBOOK and rollback automation (P2); minimal rollback (redeploy previous image) can be documented in a short checklist.
- CSP tightening (e.g. nonce-based) and advanced rate limit tuning.

**Must not wait (must be true for staging):**

- No public uploads; no path traversal; no JWT fallback; no unsafe JSON in upload; CORS strict for non-dev; CI test gate. Without these, staging is not safe for real users or real data.

---

## Part 4 — Risk-Based Judgment: What Blocks Staging Entirely

**Hard blockers (do not deploy to staging until fixed):**

1. **JWT secret fallback** — Enables token forgery. Any environment that might get a misconfigured env could expose signed tokens with a known secret.
2. **Public /uploads** — Multi-tenant data can be enumerated and downloaded by anyone who knows or guesses paths. Direct data breach risk.
3. **Path traversal in file manager** — Attacker can write or read outside uploads directory. Server compromise or data loss.
4. **Unsafe JSON.parse in upload** — Unhandled exception can crash the request and leak stack or leave app in inconsistent state. Easy to trigger.
5. **CORS no-origin in staging** — With credentials, allows request types that should be rejected in a production-like environment. Increases CSRF/session abuse surface.
6. **No CI test gate** — Broken auth or critical path can land in staging without any automated check. Undermines confidence in every deploy.

**Does not block staging (can be P1/P2):**

- Migration ledger, backup-before-migrate, full observability, full unit suite, RUNBOOK, image-based compose alignment. These improve stability and ops but do not by themselves allow auth bypass or data exfiltration.
- Role checks on user routes: blocks staging if staging will hold real user lists and non-admin users from day one; otherwise P1 for “stable staging.”

**Summary:** The six P0 items are the correct hard gate. Deploy to staging only when all six are done and verified. Then add P1 for a stable, production-like staging; P2 can follow in staging or production.
