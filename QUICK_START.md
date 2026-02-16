# 🚀 Quick Start Guide

## Fix everything missing (Windows)

From the project root in PowerShell (Node.js must be installed):

```powershell
.\setup-missing.ps1
```

This creates `backend/.env` (if missing), runs `npm install`, creates and migrates the database, and ensures `uploads` exists. Then run `.\start-dev.ps1` to start the app.

---

## Iniciar el Sistema en 3 Pasos

### Paso 1: Instalar Dependencias (solo la primera vez)

```bash
cd backend
npm install
```

### Paso 2: Iniciar el Servidor

**Opción A - Usando el script:**
```bash
./START_SERVER.sh
```

**Opción B - Manualmente:**
```bash
cd backend
npm start
```

El servidor estará disponible en: `http://localhost:8000`

### Paso 3: Verificar que Funciona

Abre en tu navegador o usa curl:
```
http://localhost:8000/api/healthz
```

Deberías ver:
```json
{
  "status": "OK",
  "message": "Restaurant Cost Control API is running"
}
```

## 🎯 Próximos Pasos

### 1. Registrar Primera Empresa

```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "companyName": "Mi Restaurante",
    "email": "admin@restaurante.com",
    "password": "password123",
    "firstName": "Juan",
    "lastName": "Pérez"
  }'
```

### 2. Iniciar Sesión

```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@restaurante.com",
    "password": "password123"
  }'
```

### 3. Usar el Token

Guarda el token de la respuesta y úsalo en todas las peticiones:

```bash
TOKEN="tu-token-aqui"

curl -X GET http://localhost:8000/api/dashboard/summary \
  -H "Authorization: Bearer $TOKEN"
```

## 📚 Documentación Completa

- **API_QUICK_START.md** - Guía rápida de la API
- **INTEGRATION_GUIDE.md** - Integración frontend-backend
- **backend/README.md** - Documentación del backend
- **BACKEND_IMPLEMENTATION_SUMMARY.md** - Resumen técnico

## 🛠️ Comandos Útiles

```bash
# Verificar configuración
cd backend && npm run verify

# Ejecutar migraciones
cd backend && npm run migrate

# Modo desarrollo (con auto-reload)
cd backend && npm run dev
```

## ✅ Checklist

- [ ] Node.js instalado (v16+)
- [ ] Dependencias instaladas (`npm install`)
- [ ] Servidor iniciado (`npm start`)
- [ ] Health check funciona
- [ ] Empresa registrada
- [ ] Login exitoso
- [ ] Token obtenido

## 🆘 Problemas Comunes

### Puerto 8000 ya en uso
```bash
# Cambiar puerto en backend/.env
PORT=8001
```

### Error de base de datos
```bash
cd backend
npm run migrate
```

### Dependencias faltantes
```bash
cd backend
npm install
```

---

**¡Listo para empezar!** 🎉
