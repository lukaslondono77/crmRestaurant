# Backend structure — Cloudignite Cost Control

API Node.js/Express, SQLite, puerto 8000 por defecto.

---

## 1. Estructura de carpetas

```
backend/
├── src/
│   ├── server.js                 # Entrada: Express app, CORS, rutas, listen
│   ├── config/
│   │   ├── database.js           # Conexión SQLite
│   │   └── env.js                # Variables de entorno, validación
│   ├── middleware/
│   │   ├── auth.js               # JWT: authenticate, tenantFilter
│   │   ├── circuitBreaker.js     # Circuit breaker para dependencias
│   │   ├── metrics.js            # Métricas (opcional)
│   │   ├── security.js           # Helmet, rate-limit, etc.
│   │   └── timeout.js            # Timeouts por ruta
│   ├── routes/
│   │   ├── analyticsRoutes.js    # /api/analytics (food-cost, trends, suppliers, compare, alerts)
│   │   ├── authRoutes.js         # /api/auth (login, register, me)
│   │   ├── dashboardRoutes.js    # /api/dashboard (metrics, monthly-report, action-items)
│   │   ├── inventoryRoutes.js    # /api/inventory
│   │   ├── invoiceRoutes.js      # /api/invoices
│   │   ├── posRoutes.js          # /api/pos
│   │   ├── wasteRoutes.js        # /api/waste
│   │   ├── seedRoutes.js         # /api/seed (initialize)
│   │   ├── userRoutes.js         # /api/users, profile
│   │   ├── squareRoutes.js       # Square API
│   │   ├── recipesRoutes.js
│   │   ├── calendarRoutes.js
│   │   ├── chatRoutes.js
│   │   ├── contactRoutes.js
│   │   ├── crmRoutes.js
│   │   ├── ecommerceRoutes.js
│   │   ├── emailRoutes.js
│   │   ├── eventsRoutes.js
│   │   ├── fileManagerRoutes.js
│   │   ├── helpdeskRoutes.js
│   │   ├── hospitalRoutes.js
│   │   ├── hrRoutes.js
│   │   ├── kanbanRoutes.js
│   │   ├── lmsRoutes.js
│   │   ├── performanceRoutes.js
│   │   ├── projectManagementRoutes.js
│   │   ├── schoolRoutes.js
│   │   ├── socialRoutes.js
│   │   └── todoRoutes.js
│   ├── services/
│   │   ├── analyticsService.js   # Métricas, food cost, loss/gain, savings, alerts, etc.
│   │   ├── monthlyReportService.js
│   │   ├── userService.js
│   │   ├── ocrService.js         # OCR facturas / POS
│   │   ├── squareService.js
│   │   ├── cacheService.js
│   │   ├── calendarService.js
│   │   ├── chatService.js
│   │   ├── contactService.js
│   │   ├── crmService.js
│   │   ├── ecommerceService.js
│   │   ├── emailService.js
│   │   ├── eventsService.js
│   │   ├── fileManagerService.js
│   │   ├── helpdeskService.js
│   │   ├── hospitalService.js
│   │   ├── hrService.js
│   │   ├── kanbanService.js
│   │   ├── lmsService.js
│   │   ├── projectManagementService.js
│   │   ├── schoolService.js
│   │   └── socialService.js
│   └── utils/
│       ├── errorHandler.js
│       ├── featureFlags.js
│       └── pagination.js
├── database/
│   ├── schema.sql                # Esquema base (users, tenants, sales, purchases, waste, …)
│   ├── init.js                   # Inicialización DB
│   ├── run-migration.js
│   ├── run-todos-migration.js
│   └── migrations/
│       ├── 001_add_multi_tenant.sql
│       ├── 002_add_todos.sql
│       ├── … (003–020)
│       ├── 021_add_inventory_counts.sql
│       └── …
├── data/
│   ├── initial_inventory_counts.json
│   ├── inventory_items.json
│   ├── recipes_bom.json
│   └── tequilas_town_menu.json
├── scripts/
│   ├── create-test-user.js
│   ├── verify-setup.js
│   ├── backup-database.js
│   ├── run-migrations.js
│   ├── apply-optimizations.js
│   ├── import-menu.js
│   ├── set-initial-inventory.js
│   ├── deploy-production.sh
│   └── …
├── uploads/                      # Archivos subidos (facturas, POS, etc.)
├── package.json
├── Dockerfile
├── .dockerignore
├── .gitignore
└── README.md
```

---

## 2. Resumen por capa

| Capa        | Ubicación     | Rol                                                                 |
|------------|---------------|---------------------------------------------------------------------|
| Entrada    | `src/server.js` | Express, CORS, middleware global, montaje de rutas, `listen`        |
| Config     | `src/config/`   | DB, env, validación                                                |
| Middleware | `src/middleware/` | Auth JWT, tenant, seguridad, timeouts, circuit breaker, métricas   |
| Rutas      | `src/routes/`    | REST por dominio (dashboard, auth, inventory, waste, etc.)         |
| Lógica     | `src/services/`  | Cálculos, consultas DB, integraciones (Square, OCR)                |
| Utilidades | `src/utils/`     | Errores, feature flags, paginación                                 |
| Datos      | `database/`, `data/` | Schema, migraciones, seeds, JSON de ejemplo                    |

---

## 3. Cost control – rutas y servicios clave

| Recurso       | Ruta base        | Archivo de rutas       | Servicio principal     |
|---------------|------------------|------------------------|------------------------|
| Dashboard     | `/api/dashboard` | `dashboardRoutes.js`   | `analyticsService`     |
| Analíticas    | `/api/analytics` | `analyticsRoutes.js`   | `analyticsService`     |
| Auth          | `/api/auth`      | `authRoutes.js`        | (auth + userService)   |
| Inventory     | `/api/inventory` | `inventoryRoutes.js`   | (queries en rutas/servicios) |
| Invoices      | `/api/invoices`  | `invoiceRoutes.js`     | + `ocrService`         |
| POS           | `/api/pos`       | `posRoutes.js`         | + `ocrService`         |
| Waste         | `/api/waste`     | `wasteRoutes.js`       | —                      |
| Seed          | `/api/seed`      | `seedRoutes.js`        | —                      |
