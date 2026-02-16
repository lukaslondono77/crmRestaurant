# Deployment checklist — Cloudignite Backend

## 1. Environment variables

- [ ] Copy `.env.example` to `.env` and set values.
- [ ] **JWT_SECRET:** Min 32 characters. Generate:  
  `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- [ ] **NODE_ENV:** `production` in production.
- [ ] **ALLOWED_ORIGINS:** Set to your frontend origin(s). No `*` in production.
- [ ] **Square** (if used): `SQUARE_APPLICATION_ID`, `SQUARE_ACCESS_TOKEN`, `SQUARE_LOCATION_ID`, `SQUARE_ENVIRONMENT`.

## 2. Database

- [ ] Run `node database/run-migration.js` (adds `tenant_id`, etc.) if not already applied.
- [ ] Run `npm run migrate` for remaining migrations.
- [ ] Ensure `database/restaurant_cost.db` (or `DATABASE_PATH`) exists and is writable.
- [ ] Indexes: migration `020_add_performance_indexes.sql` creates them. Keep it applied.

## 3. Security

- [ ] **Security headers** (X-Content-Type-Options, X-Frame-Options, etc.) and **rate limiting** are enabled via `middleware/security.js`.
- [ ] **CORS:** Restrict `ALLOWED_ORIGINS` to your frontend.
- [ ] **JWT:** No default/weak secret in production.
- [ ] **Uploads:** Restrict file types/sizes (handled in multer config).

## 4. Production server

- [ ] Run behind a reverse proxy (e.g. nginx). Use `app.set('trust proxy', 1)` if needed for rate limiting.
- [ ] Use **HTTPS** in production.
- [ ] Use a process manager (e.g. **PM2**):  
  `pm2 start src/server.js --name cloudignite-api`
- [ ] Logging: set `LOG_LEVEL=info` (or `error`).

## 5. Health checks

- [ ] **Basic:** `GET /api/healthz` → `{ status: 'OK' }`
- [ ] **Detailed:** `GET /api/healthz?detailed=1` → adds `database`, `uptimeSeconds`, `memory`. Use for monitoring.

## 6. Post-deploy verification

- [ ] `node scripts/verify-deployment.js [API_URL]` (or `npm run verify:deploy`) — all checks pass. Uses `API_URL` env or default `http://localhost:8000`.
- [ ] `node scripts/test-all-endpoints.js https://your-api-domain.com` — optional; full endpoint suite.
- [ ] Frontend login → dashboard loads → metrics, action items, reports work.
- [ ] Upload invoice / POS / waste → data appears in dashboard.
- [ ] `node scripts/monitor-production.js [API_URL] [token]` — health, disk, optional latency checks; use for ongoing monitoring.

## 7. Error handling

- **INSUFFICIENT_DATA:** Use `ApiError` with `ErrorCodes.INSUFFICIENT_DATA` and `details: { suggestion: '...' }` when relevant. `formatErrorResponse` exposes `error.suggestion` to the client.

## 8. Deploy & rollback scripts

- [ ] **Deploy:** `npm run deploy` or `./scripts/deploy-production.sh`. Optional: `API_URL`, `SKIP_GIT_PULL=1`, `GIT_BRANCH`. Run from `backend/`.
- [ ] **Verify after deploy:** `npm run verify:deploy` or `node scripts/verify-deployment.js [API_URL]`.
- [ ] **Monitor:** `node scripts/monitor-production.js [API_URL] [token]`. Env: `RESPONSE_TIME_THRESHOLD_MS`, `DISK_FREE_PCT_THRESHOLD`, `ALERT_*`.
- [ ] **Rollback:** `./scripts/rollback.sh` (or `--no-git` to skip git revert). Restores latest backup under `BACKUP_ROOT`.

## 9. Optional

- [ ] **Caching:** `ENABLE_CACHE=true` (default). Dashboard metrics and food-cost use cache when enabled.
- [ ] **Backups:** Use `npm run backup` (or `node scripts/backup-database.js create`) on a schedule.
- [ ] **PostgreSQL/MySQL:** For production at scale, plan migration from SQLite; schema and queries would need adaptation.
