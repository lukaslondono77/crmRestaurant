# Restaurant Cost Control - Backend API

Backend completo para el sistema de control de costos de restaurantes con 17 módulos implementados.

## 🚀 Inicio Rápido

### Prerrequisitos
- Node.js 16+ 
- npm o yarn

### Instalación

```bash
# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus configuraciones

# Verificar configuración
npm run verify

# Ejecutar migraciones (si es necesario)
npm run migrate

# Iniciar servidor
npm start

# O en modo desarrollo con auto-reload
npm run dev
```

El servidor se ejecutará en `http://localhost:8000`

## 📦 Módulos Implementados

### MAIN
- ✅ **Dashboard** - Resumen, análisis, reportes, alertas

### APPS (8 módulos)
1. ✅ **To Do List** - Gestión de tareas
2. ✅ **Calendar** - Eventos y calendario
3. ✅ **Contacts** - Gestión de contactos
4. ✅ **Chat** - Mensajería
5. ✅ **Email** - Gestión de correos
6. ✅ **Kanban Board** - Tableros Kanban
7. ✅ **File Manager** - Gestión de archivos
8. ✅ **E-Commerce** - Tienda online

### PAGES (9 módulos)
9. ✅ **CRM** - Gestión de relaciones con clientes
10. ✅ **Project Management** - Gestión de proyectos
11. ✅ **LMS** - Sistema de aprendizaje
12. ✅ **Help Desk** - Mesa de ayuda
13. ✅ **HR Management** - Recursos humanos
14. ✅ **Events** - Gestión de eventos
15. ✅ **Social** - Red social interna
16. ✅ **Users & Profile** - Usuarios y perfiles

## 🔐 Autenticación

### Registrar nueva empresa
```bash
POST /api/auth/register
{
  "companyName": "Mi Restaurante",
  "email": "admin@restaurante.com",
  "password": "password123",
  "firstName": "Juan",
  "lastName": "Pérez"
}
```

### Iniciar sesión
```bash
POST /api/auth/login
{
  "email": "admin@restaurante.com",
  "password": "password123"
}
```

### Usar token
Incluir en headers:
```
Authorization: Bearer <token>
```

## 📡 Endpoints Principales

### Autenticación
- `POST /api/auth/register` - Registrar empresa/usuario
- `POST /api/auth/login` - Iniciar sesión
- `GET /api/auth/me` - Obtener usuario actual

### Dashboard
- `GET /api/dashboard/summary` - Resumen del dashboard
- `GET /api/dashboard/action-items` - Items de acción
- `GET /api/dashboard/alerts` - Alertas

### Módulos
- `/api/todos/*` - To Do List
- `/api/calendar/*` - Calendar
- `/api/contacts/*` - Contacts
- `/api/chat/*` - Chat
- `/api/emails/*` - Email
- `/api/kanban/*` - Kanban Board
- `/api/files/*` - File Manager
- `/api/ecommerce/*` - E-Commerce
- `/api/crm/*` - CRM
- `/api/projects/*` - Project Management
- `/api/lms/*` - LMS
- `/api/helpdesk/*` - Help Desk
- `/api/hr/*` - HR Management
- `/api/events/*` - Events
- `/api/social/*` - Social
- `/api/users/*` - Users & Profile

## 🛠️ Scripts Disponibles

```bash
npm start          # Iniciar servidor en producción
npm run dev        # Iniciar servidor en desarrollo (con nodemon)
npm run verify     # Verificar configuración del backend
npm run migrate    # Ejecutar todas las migraciones
npm run init-db    # Inicializar base de datos
npm run deploy     # Despliegue producción (backup, deps, migrate, PM2, verify)
npm run verify:deploy   # Verificación post-despliegue (health, auth, endpoints)
npm run monitor    # Monitoreo de producción (health, disco, latencia)
npm run test:endpoints # Suite de pruebas de endpoints
```

## ✅ Post-Deployment Verification & Production Scripts

### Verificación post-despliegue

Ejecuta **después de cada deploy** para validar que la API responde correctamente:

```bash
# Local
npm run verify:deploy
# o
node scripts/verify-deployment.js

# Producción (API_URL por env o argumento)
API_URL=https://api.tudominio.com npm run verify:deploy
node scripts/verify-deployment.js https://api.tudominio.com
```

Comprueba: **API accesible**, **base de datos**, **auth (register + /me)**, **directorios de uploads**, **endpoints críticos** (dashboard, inventory, analytics).

### Monitoreo de producción

Chequeos ligeros de salud, disco y latencia:

```bash
# Solo health (sin token)
npm run monitor
node scripts/monitor-production.js https://api.tudominio.com

# Con token admin (incluye latencia de /api/dashboard/metrics)
node scripts/monitor-production.js https://api.tudominio.com "Bearer <JWT>"
```

Variables de entorno opcionales: `API_URL`, `ADMIN_TOKEN`, `RESPONSE_TIME_THRESHOLD_MS` (default 2000), `DISK_FREE_PCT_THRESHOLD` (default 10), `ALERT_EMAIL_ENABLED`, `ALERT_SLACK_ENABLED`, `ALERT_SMS_ENABLED`.

### Despliegue y rollback

```bash
# Despliegue (desde backend/)
npm run deploy
# Opcionales: API_URL, SKIP_GIT_PULL=1, GIT_BRANCH=main

# Rollback al último backup
./scripts/rollback.sh
# Solo restaurar DB (sin git revert): ./scripts/rollback.sh --no-git
```

El script de deploy: backup DB → (opcional) `git pull` → `npm ci` → migraciones → permisos → reinicio PM2 → espera → `verify-deployment` → log.

Ver `DEPLOYMENT_CHECKLIST.md` y `.env.example` para variables y checklist completo.

## 📁 Estructura del Proyecto

```
backend/
├── src/
│   ├── routes/          # Rutas API (26 archivos)
│   ├── services/        # Lógica de negocio (19 archivos)
│   ├── middleware/      # Middleware (auth, etc.)
│   ├── config/          # Configuración
│   └── utils/           # Utilidades
├── database/
│   ├── migrations/      # Migraciones SQL (17 archivos)
│   └── restaurant_cost.db
├── scripts/             # Scripts de utilidad
│   ├── verify-setup.js
│   └── run-migrations.js
├── uploads/             # Archivos subidos
└── package.json
```

## 🔒 Seguridad

- ✅ **JWT Authentication** - Autenticación con tokens
- ✅ **Multi-Tenancy** - Aislamiento de datos por tenant
- ✅ **Role-Based Access Control** - Control de acceso por roles
- ✅ **Input Validation** - Validación de datos de entrada
- ✅ **Password Hashing** - Bcrypt para contraseñas
- ✅ **Error Handling** - Manejo estandarizado de errores

## 📊 Base de Datos

- **SQLite** - Base de datos actual (puede migrarse a PostgreSQL/MySQL)
- **17 Migraciones** - Todas las tablas necesarias
- **Multi-Tenant** - Soporte completo para múltiples empresas

## 🧪 Testing

```bash
# Verificar configuración
npm run verify

# Health check
curl http://localhost:8000/api/healthz
```

## 📝 Variables de Entorno

Crear archivo `.env`:

```env
PORT=8000
JWT_SECRET=your-secret-key-here
NODE_ENV=development

# Square API (opcional)
SQUARE_ACCESS_TOKEN=your-square-token
SQUARE_LOCATION_ID=your-location-id
SQUARE_ENVIRONMENT=sandbox
```

## 🐛 Troubleshooting

### Error de conexión a base de datos
```bash
# Verificar que la base de datos existe
ls -la database/restaurant_cost.db

# Ejecutar migraciones
npm run migrate
```

### Error de autenticación
- Verificar que el token JWT esté en el header
- Verificar que el token no haya expirado
- Verificar que el usuario existe y está activo

### Error de permisos
- Verificar que el usuario tenga el rol correcto
- Verificar que el tenant_id coincida

## 📚 Documentación Adicional

Ver `BACKEND_IMPLEMENTATION_SUMMARY.md` para documentación completa del sistema.

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto es parte del template Fila - Multipurpose Bootstrap 5 Admin Dashboard.

## 🆘 Soporte

Para problemas o preguntas:
1. Revisa la documentación
2. Ejecuta `npm run verify` para verificar la configuración
3. Revisa los logs del servidor

---

**Versión:** 1.0.0  
**Última actualización:** 2024
