# Cómo Iniciar CRM Restaurant

Guía completa con todos los scripts y comandos para iniciar el proyecto.

---

## Requisitos previos

- **Node.js** v18+ — https://nodejs.org
- **PowerShell** (Windows)
- **Python 3** (opcional, para frontend)
- **Docker Desktop** (solo si usas Docker)

---

## 0. PowerShell — Permitir scripts (solo la primera vez)

Si aparece *"running scripts is disabled on this system"*, ejecuta:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Confirma con `S` (Sí). Luego podrás ejecutar `.\start-dev.ps1` y `.\setup-missing.ps1`.

**Si no puedes cambiar la política** (ej. política de empresa), usa este comando en su lugar:

```powershell
powershell -ExecutionPolicy Bypass -File .\start-dev.ps1
```

Para setup:
```powershell
powershell -ExecutionPolicy Bypass -File .\setup-missing.ps1
```

---

## 1. LOCAL — Primera vez (setup)

```powershell
cd c:\Users\lukas\OneDrive\Desktop\crmRestaurant-main
.\setup-missing.ps1
```

**Qué hace:**
- Crea `backend/.env` y `.env` en la raíz
- Ejecuta `npm install` en backend
- Crea la base de datos y ejecuta migraciones
- Crea la carpeta `uploads`

---

## 2. LOCAL — Iniciar la app

### Opción A: Script automático (recomendado)

```powershell
cd c:\Users\lukas\OneDrive\Desktop\crmRestaurant-main
.\start-dev.ps1
```

- Abre backend (puerto 8000) y frontend (puerto 3000)
- Abre el navegador en la app
- **Detener:** cierra las dos ventanas de PowerShell

### Opción B: Manual — Backend

```powershell
cd c:\Users\lukas\OneDrive\Desktop\crmRestaurant-main\backend
npm run dev
```

O en modo producción:
```powershell
npm start
```

### Opción C: Manual — Frontend

Con Python:
```powershell
cd c:\Users\lukas\OneDrive\Desktop\crmRestaurant-main\fila
python server.py
```

Sin Python:
```powershell
cd c:\Users\lukas\OneDrive\Desktop\crmRestaurant-main
npx serve fila -p 3000
```

### Abrir la app

```
http://localhost:3000/core/index.html
```

---

## 3. DOCKER — Iniciar con Docker

```powershell
cd c:\Users\lukas\OneDrive\Desktop\crmRestaurant-main
docker compose up -d --build
```

**Detener:**
```powershell
docker compose down
```

**Detener y eliminar volúmenes (borra datos):**
```powershell
docker compose down -v
```

---

## 4. Comandos del backend (desde `backend/`)

| Comando | Descripción |
|---------|-------------|
| `npm start` | Inicia el servidor (producción) |
| `npm run dev` | Inicia con nodemon (recarga automática) |
| `npm run init-db` | Inicializa la base de datos |
| `npm run migrate` | Ejecuta migraciones |
| `npm run apply-optimizations` | Aplica índices de rendimiento a la base de datos (ejecutar una vez) |
| `npm run verify` | Verifica la configuración |
| `npm run backup` | Crea backup de la base de datos |
| `npm run backup:list` | Lista backups |
| `npm run test:auth` | Pruebas de autenticación |
| `npm run test:smoke-e2e` | Pruebas smoke end-to-end |
| `npm run test:all` | Ejecuta todas las pruebas |

---

## 5. URLs importantes

| Servicio | URL |
|----------|-----|
| **App (frontend)** | http://localhost:3000/core/index.html |
| **API (backend)** | http://localhost:8000 |
| **Health check** | http://localhost:8000/api/healthz |

---

## 6. Verificar que funciona

**API:**
```powershell
curl http://localhost:8000/api/healthz
```

Respuesta esperada:
```json
{"status":"OK","message":"Restaurant Cost Control API is running"}
```

**App:** Abre http://localhost:3000/core/index.html en el navegador.

---

## 7. Solución de problemas

| Problema | Solución |
|---------|----------|
| "running scripts is disabled" | Ejecuta `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser` |
| "Node.js not found" | Instala Node.js desde nodejs.org |
| "JWT_SECRET is required" | Ejecuta `.\setup-missing.ps1` |
| Puerto 8000 o 3000 en uso | Cierra otros programas o cambia puerto en `backend/.env` |
| Docker: "Origin required" | Ya corregido en el código; reconstruye con `docker compose up -d --build` |

---

## 8. Rendimiento (opcional)

Para que la app vaya más rápido:

1. **Índices de base de datos** (ejecutar una vez):
   ```powershell
   cd backend
   npm run apply-optimizations
   ```

2. **Variables en `backend/.env`** (ya incluidas por defecto):
   - `ENABLE_CACHE=true` — cache para dashboard y analytics
   - `CACHE_TTL_DASHBOARD=600000` — 10 min
   - `CACHE_TTL_ANALYTICS=900000` — 15 min
   - `CACHE_MAX_SIZE=200`

3. **Compresión** — El backend ya comprime respuestas (gzip) automáticamente.

---

## 9. Para presentaciones o reuniones

1. Ejecuta `.\start-dev.ps1` **5–10 minutos antes**
2. Verifica que la app carga
3. Cierra otras aplicaciones pesadas
4. Mantén las ventanas de PowerShell abiertas durante la demo
