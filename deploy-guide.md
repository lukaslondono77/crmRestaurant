# Guía de despliegue — Cloudignite

Resumen de despliegue. Detalle en `backend/DEPLOYMENT_CHECKLIST.md`.

---

## Desarrollo local

```bash
# Raíz del proyecto
./start-all.sh          # Backend :8000 + Frontend :3000
./reset-demo.sh         # Usuario admin@test.com + seed Apps/Pages
./run-tests.sh          # Suite completa (backend debe estar arriba)
```

- **Login:** http://localhost:3000/sign-in.html — `admin@test.com` / `admin123`
- **Diagnóstico:** http://localhost:3000/diagnose-connection.html

---

## Producción

1. **Variables de entorno:** Ver `backend/.env.example`. Mínimo: `JWT_SECRET`, `DATABASE_PATH`, `NODE_ENV=production`, `ALLOWED_ORIGINS`.
2. **Base de datos:** Migraciones con `cd backend && npm run migrate`. Para producción, considerar PostgreSQL/MySQL.
3. **Backend:** `cd backend && npm start` (o PM2: `pm2 start src/server.js --name cloudignite-api`).
4. **Frontend:** Servir estáticos desde `fila/` (Nginx, S3+CloudFront, etc.). `API_BASE_URL` debe apuntar al backend en producción.
5. **Verificación:** `node scripts/verify-deployment.js <API_URL>`.
6. **Despliegue automatizado:** `backend/scripts/deploy-production.sh`, `rollback.sh`. Ver `DEPLOYMENT_CHECKLIST.md`.

---

## Scripts útiles

| Script | Uso |
|--------|-----|
| `start-all.sh` | Inicia backend + frontend (dev) |
| `reset-demo.sh` | Usuario demo + seed módulos |
| `run-tests.sh` | Ejecuta `npm run test:all` |
| `backend/scripts/deploy-production.sh` | Deploy producción |
| `backend/scripts/rollback.sh` | Rollback |
| `backend/scripts/verify-deployment.js` | Verificación post-deploy |
