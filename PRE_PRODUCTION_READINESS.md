# Pre-Production (Staging) Readiness — Senior Review

**Role:** Senior AI Software Agent / Staff Software Engineer  
**Scope:** Promote from local-dev to a pre-production (staging) environment that mirrors production behavior.  
**Assumption:** Real users, real data, real failure scenarios. Staging is not a playground.

---

## 1. Pre-Production Blockers (Must-Fix)

These **must** be resolved before any staging deployment. No exceptions.

| # | Blocker | Location | Risk |
|---|---------|----------|------|
| 1 | **JWT secret fallback** — Tokens can be signed with a known default if `JWT_SECRET` is missing in any code path. | `backend/src/routes/authRoutes.js` (lines 56–57, 141–142) | Token forgery; full auth bypass. |
| 2 | **Public `/uploads`** — Static files served without auth or tenant checks. | `backend/src/server.js` (line 64) | Data leakage across tenants; exposure of sensitive documents. |
| 3 | **Path traversal in folder creation** — User-controlled `name` (and inherited `parent.path`) used directly in filesystem path. | `backend/src/services/fileManagerService.js` (lines 83–87, 106–107) | Escape upload dir; overwrite or read arbitrary paths. |
| 4 | **Unsafe `JSON.parse` in upload** — Malformed `req.body.tags` can throw; no validation. | `backend/src/routes/fileManagerRoutes.js` (line 133) | Unhandled exception; 500 and possible info leak. |
| 5 | **CORS allows no-origin with credentials** — Requests with no `Origin` accepted when `credentials: true`. | `backend/src/server.js` (lines 18–21) | In staging/prod, can facilitate CSRF-style abuse. |
| 6 | **No CI test gate** — Pipeline does not run behavioral tests before build/deploy. | `.github/workflows/ci-cd.yml` | Broken behavior can reach staging. |

**Verdict:** Until 1–6 are addressed, **do not deploy to pre-production.**

---

## 2. Required Enhancements

### 2.1 Security & Authentication

| Improvement | Detail | File / Area |
|-------------|--------|-------------|
| Remove JWT fallback | Use only `process.env.JWT_SECRET`; fail fast if undefined. Rely on `config/env.js` so server never starts without it. | `backend/src/routes/authRoutes.js` |
| Protect uploads | Remove `express.static` for `/uploads`. Add authenticated download route(s) that verify tenant and ownership before serving file. | `backend/src/server.js`; new or existing file route |
| Sanitize folder/file names | Reject or strip `..`, `/`, `\`, and control chars in `name` (and validate `parent.path` from DB). Build path from sanitized segments only. | `backend/src/services/fileManagerService.js` |
| Safe JSON for upload | Parse `req.body.tags` in try/catch; treat invalid JSON as `null` or reject with 400. Optionally validate array shape. | `backend/src/routes/fileManagerRoutes.js` |
| CORS: require origin in non-dev | In staging/production, reject requests with no `Origin` (or restrict to explicit list). Keep no-origin allow only for `NODE_ENV=development`. | `backend/src/server.js` |
| Apply API rate limiting | Use `rateLimiters.api` (and `rateLimiters.upload` on upload routes) so all API traffic is rate limited, not only auth. | `backend/src/server.js` |
| Role checks on user routes | Restrict list/get user endpoints to admin (or appropriate role) so any authenticated user cannot enumerate users. | `backend/src/routes/userRoutes.js` |

### 2.2 Configuration & Environment Separation

| Improvement | Detail | File / Area |
|-------------|--------|-------------|
| Env-specific config | Document and enforce required vars per environment (e.g. `NODE_ENV`, `ALLOWED_ORIGINS`, `JWT_SECRET`, optional `DATABASE_PATH`). | `backend/.env.example`, `backend/src/config/env.js` |
| No default ALLOWED_ORIGINS in prod | In production/staging, require `ALLOWED_ORIGINS` to be set explicitly (no fallback to localhost). | `backend/src/config/env.js`, `backend/src/server.js` |
| Frontend API base URL | Replace hardcoded `http://localhost:8000` in `authService.js` with same config as `apiService` (e.g. `APP_CONFIG.API_BASE_URL` or relative `/api`). | `fila/assets/js/auth/authService.js` |
| Feature flags for staging | Use `ENABLE_SQUARE_SYNC`, `ENABLE_OWNER_VIEW`, etc., with explicit staging values; document in runbook. | `backend/.env.example`, docs |

### 2.3 Data Safety & Migrations

| Improvement | Detail | File / Area |
|-------------|--------|-------------|
| Migration ledger | Introduce a migrations table and run migrations sequentially, recording applied migration id/name so re-runs are idempotent and order is guaranteed. | `backend/scripts/run-migrations.js`, new migration table |
| Backup before migrate | In deploy pipeline, run backup (or snapshot) before applying migrations in staging/prod. | Deploy script / CI |
| Tenant isolation audit | Review all queries that filter by `tenant_id`; ensure no route can access another tenant’s data. | All route/service layers using `req.tenantId` |
| DATABASE_PATH from env | Use `process.env.DATABASE_PATH` in database config with a safe default so staging/prod can point to a dedicated path. | `backend/src/config/database.js` |

### 2.4 Observability (Logs, Metrics, Tracing)

| Improvement | Detail | File / Area |
|-------------|--------|-------------|
| Structured logging | Replace ad hoc `console.log/error/warn` with a structured logger (e.g. pino or winston): JSON lines, log level, request id, tenant id where available. | New logger module; `backend/src/**` |
| Audit log persistence | Persist audit events (login, register, sensitive actions) to file or external service instead of stdout only. | `backend/src/middleware/security.js` |
| Enable metrics in staging | Add `ENABLE_METRICS` to feature flags and set to true in staging; ensure metrics middleware runs and key endpoints are observable. | `backend/src/utils/featureFlags.js`, `backend/src/middleware/metrics.js` |
| Health contract | Ensure `/api/healthz` (and optional `?detailed=1`) is stable and does not expose sensitive env; use for readiness/liveness. | `backend/src/server.js` |

### 2.5 Testing (Unit, Integration, Smoke)

| Improvement | Detail | File / Area |
|-------------|--------|-------------|
| Real `npm test` | Replace placeholder script with a real test runner (e.g. Jest/Vitest); add unit tests for auth, tenant filtering, and critical services. | `backend/package.json`, new `backend/**/*.test.js` or `__tests__` |
| CI test job | Add a job that runs `npm run test` (and optionally `npm run test:all` or smoke) in backend; fail the pipeline on failure. | `.github/workflows/ci-cd.yml` |
| Smoke test in deploy | After staging deploy, run smoke test (e.g. health + login + one protected endpoint) and fail deploy on failure. | `.github/workflows/ci-cd.yml`, deploy step |
| Contract tests | Optionally add a small set of contract tests for critical API responses so breaking changes are caught in CI. | New test suite |

### 2.6 CI/CD & Deployment Workflow

| Improvement | Detail | File / Area |
|-------------|--------|-------------|
| Test before build | Run backend tests (and lint if present) before Docker build; no deploy of untested code. | `.github/workflows/ci-cd.yml` |
| Staging deploy real | Replace placeholder staging deploy with real SSH/container deploy to staging environment; use same image pattern as production. | `.github/workflows/ci-cd.yml` |
| Image for compose | Align production deploy with image-based run: compose (or deploy script) should use the built image tag, not only `build:`. | `docker-compose.yml`, deploy step in CI |
| Secrets and vars | Document required secrets (e.g. `JWT_SECRET`, `DEPLOY_SSH_*`) and repo/environment variables (e.g. `ALLOWED_ORIGINS`, `PRODUCTION_URL`) for staging and prod. | Docs, README or RUNBOOK |

---

## 3. Environment Expectations

| Aspect | Development | Pre-Production (Staging) | Production |
|--------|-------------|---------------------------|------------|
| **NODE_ENV** | `development` | `staging` or `production` | `production` |
| **JWT_SECRET** | Required, min 32 chars; no fallback | Unique per env, from secrets store | Unique, from secrets store |
| **ALLOWED_ORIGINS** | Default localhost allowed | Explicit list (staging URL only) | Explicit list (prod URL only) |
| **CORS no-origin** | Allow (tools, Postman) | Reject or strict list | Reject or strict list |
| **Database** | SQLite local file OK | SQLite or dedicated DB; backups | Dedicated DB; backups; no shared file with dev |
| **Logging** | Console OK | Structured; level `info`; persisted | Structured; level `info` or `warn`; persisted |
| **Metrics** | Optional | On | On |
| **Rate limits** | Lenient | Stricter (e.g. production-like) | Production values |
| **Feature flags** | E.g. Square off, owner view on | Mirror prod or slightly relaxed | Prod values |
| **Secrets** | `.env` in repo (gitignored) | Injected (e.g. GitHub Actions / vault) | Injected only; never in repo |

**Config validation:** On startup, validate required vars for current `NODE_ENV` (e.g. in staging/production require `ALLOWED_ORIGINS`, no default). Fail fast with a clear message.

---

## 4. Operational Readiness

### 4.1 Startup Checks and Fail-Fast

- **Already in place:** `config/env.js` validates `JWT_SECRET` and exits if missing.
- **Add:** After DB connect, run a single read (e.g. `SELECT 1`) and optionally check migrations table exists / migrations applied. If not, exit with non-zero.
- **Add:** If using file storage, ensure upload directory exists and is writable; fail startup if not.
- **Add:** In non-development, require `ALLOWED_ORIGINS` to be set.

### 4.2 Rollback Strategy

- **Image-based deploy:** Keep previous image tag available; rollback = redeploy previous tag and run migrations if needed (prefer backward-compatible migrations).
- **Database:** Prefer backward-compatible migrations; have a documented rollback path for the last N migrations (e.g. restore from backup + re-run prior migration set).
- **Document:** In RUNBOOK, add “Rollback” section: when to rollback, how to trigger (e.g. re-run workflow with previous SHA, or manual SSH + compose).

### 4.3 Backup and Recovery

- **Staging:** Automated backup before migration or on schedule (e.g. daily); retain at least one backup.
- **Recovery:** Document restore steps (stop app, restore DB, run migrations if needed, start app).
- **Scripts:** `backend/scripts/backup-database.js` exists; integrate into deploy or cron for staging/prod.

---

## 5. Acceptance Criteria: “Is This System Ready for Pre-Production?”

Use this as a gate. **Only promote when every item is “Yes” or explicitly waived with a documented reason.**

### Security & Auth
- [ ] JWT fallback removed; server does not start without valid `JWT_SECRET`.
- [ ] `/uploads` not served as public static; downloads go through authenticated, tenant-checked route(s).
- [ ] File/folder path construction sanitized; no path traversal.
- [ ] Upload route parses `tags` safely and applies upload rate limiting.
- [ ] CORS in staging/prod does not allow unknown or missing origin with credentials.
- [ ] API and upload rate limiters applied.
- [ ] User listing/access restricted by role where required.

### Config & Environment
- [ ] Staging uses explicit `ALLOWED_ORIGINS` (no localhost default in staging/prod).
- [ ] Frontend auth uses configurable API base (no hardcoded localhost for staging/prod).
- [ ] Required env vars documented per environment; validation fails fast on missing/invalid.

### Data & Migrations
- [ ] Migrations run sequentially with a ledger; idempotent where possible.
- [ ] Backup or snapshot before migrations in deploy.
- [ ] `DATABASE_PATH` (or equivalent) configurable via env.

### Observability
- [ ] Structured logging in place for key flows; audit events persisted.
- [ ] Metrics enabled in staging; health endpoint stable and non-sensitive.

### Testing & CI/CD
- [ ] `npm test` runs real tests; CI runs tests before build.
- [ ] Staging deploy is real (not placeholder); smoke test runs after deploy and fails pipeline on failure.
- [ ] Deploy uses built image; rollback path documented.

### Operations
- [ ] Startup checks: DB, optional migration state, upload dir; fail-fast.
- [ ] RUNBOOK or equivalent documents: deploy, rollback, backup/restore, required secrets/vars.

---

**Summary:** The system is **not** ready for pre-production until the six blockers are fixed and the acceptance criteria are met. Prioritize the must-fix list, then work through enhancements by category. Use this document as the staging gate and update it as conditions change.

**Execution:** For validation, prioritization (P0/P1/P2), step-by-step implementation, and "done" definition, see **`PRE_PRODUCTION_EXECUTION_PLAN.md`**.
