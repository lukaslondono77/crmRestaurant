# Cloudignite — Operations Guide

Runbook and operational procedures for deployment, monitoring, and incidents.

---

## 1. Deployment

### 1.1 Prerequisites

- Node.js 18.x (backend)
- SQLite (default) or production DB; see `backend/.env.example`
- Minimum env: `JWT_SECRET`, `DATABASE_PATH`, `NODE_ENV`, `ALLOWED_ORIGINS`

### 1.2 Local / Staging

```bash
# From repo root
./start-all.sh              # Backend :8000, frontend :3000
cd backend && npm run migrate
./run-tests.sh              # Backend must be running
```

- **Health:** `GET http://localhost:8000/api/healthz`
- **Detailed health:** `GET http://localhost:8000/api/healthz?detailed=1`

### 1.3 Production (manual)

1. Set env vars (see `backend/.env.example`).
2. `cd backend && npm ci --only=production && npm run migrate && npm start`.
3. Or use PM2: `pm2 start src/server.js --name cloudignite-api`.
4. Serve frontend from `fila/`; set `API_BASE_URL` to the backend URL.
5. Verify: `node backend/scripts/verify-deployment.js <API_URL>`.

### 1.4 Production (CI/CD)

- Push to `main` runs the full pipeline (see `.github/workflows/ci-cd.yml`):
  - Tests: `npm run test:all` (fails build on failure).
  - Security: `npm audit --audit-level=high` (fails on high/critical).
  - Build: Docker image tagged with Git SHA.
  - Deploy: SSH to VPS, pull image, `npm run migrate`, then `docker compose up -d`.
  - Smoke test: `GET <PRODUCTION_URL>/api/healthz` (retries up to 10 times).

Required secrets: `DEPLOY_SSH_HOST`, `DEPLOY_SSH_USER`, `DEPLOY_SSH_PRIVATE_KEY`. Optional: `DEPLOY_APP_DIR`, `PRODUCTION_URL` (for smoke test).

---

## 2. Database

- **Path:** `backend/database/restaurant_cost.db` (or `DATABASE_PATH` in env).
- **Migrations:** `cd backend && npm run migrate`.
- **Backups:** `cd backend && npm run backup` (creates backup in `database/backups/`).
- **List backups:** `npm run backup:list`; clean old: `npm run backup:clean`.

---

## 3. Monitoring & Health

- **Health:** `GET /api/healthz` → `{ status: 'OK' }`. Use for load balancer and smoke tests.
- **Detailed:** `GET /api/healthz?detailed=1` → adds database, uptime, memory.
- **Script:** `node backend/scripts/monitor-production.js [API_URL] [token]` for ongoing checks (health, disk, optional latency).

---

## 4. Logs

- App logs: `backend/logs/` (if configured).
- Docker: `docker compose logs -f backend`.

---

## 5. Rollback

- **Application:** Redeploy previous Docker image or run `backend/scripts/rollback.sh` if configured.
- **Database:** Restore from backup under `backend/database/backups/` and restart app.

---

## 6. Incidents

1. **API down:** Check healthz; restart backend (or container); check DB path and disk.
2. **High latency:** Check `detailed=1` health; consider cache (feature flag `ENABLE_PERFORMANCE_CACHE`) and DB indexes.
3. **Auth issues:** Verify `JWT_SECRET` unchanged and `ALLOWED_ORIGINS` includes frontend origin.
4. **Data issues:** Run `npm run test:db-integrity`; restore from backup if needed.

---

## 7. Key Files

| File / Dir | Purpose |
|------------|---------|
| `backend/.env` | Env config (do not commit) |
| `backend/database/` | SQLite DB and backups |
| `backend/uploads/` | Uploaded invoices, POS, waste files |
| `.github/workflows/ci-cd.yml` | CI/CD pipeline |
| `docker-compose.yml` | Docker run definition |
| `docs/DEVELOPMENT.md` | Dev setup and conventions |
