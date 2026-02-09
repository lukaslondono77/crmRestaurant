# API Quick Start Guide

## 🚀 Inicio Rápido

### 1. Iniciar el Backend

```bash
cd backend
npm install
npm start
```

El servidor estará disponible en `http://localhost:8000`

### 2. Registrar Primera Empresa

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

### 3. Iniciar Sesión

```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@restaurante.com",
    "password": "password123"
  }'
```

Respuesta:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "email": "admin@restaurante.com",
      "firstName": "Juan",
      "lastName": "Pérez",
      "role": "admin"
    }
  }
}
```

### 4. Usar el Token

Guardar el token y usarlo en todas las peticiones:

```bash
TOKEN="tu-token-aqui"

# Ejemplo: Obtener dashboard
curl -X GET http://localhost:8000/api/dashboard/summary \
  -H "Authorization: Bearer $TOKEN"

# Ejemplo: Obtener todos
curl -X GET http://localhost:8000/api/todos \
  -H "Authorization: Bearer $TOKEN"

# Ejemplo: Crear todo
curl -X POST http://localhost:8000/api/todos \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Nueva tarea",
    "description": "Descripción de la tarea",
    "priority": "high",
    "status": "pending"
  }'
```

## 📋 Ejemplos por Módulo

### To Do List

```bash
# Listar todos
GET /api/todos?page=1&limit=10&status=pending

# Crear todo
POST /api/todos
{
  "title": "Tarea",
  "priority": "high",
  "status": "pending"
}

# Actualizar todo
PUT /api/todos/:id
{
  "status": "completed"
}
```

### Calendar

```bash
# Listar eventos
GET /api/calendar/events?startDate=2024-01-01&endDate=2024-12-31

# Crear evento
POST /api/calendar/events
{
  "title": "Reunión",
  "start": "2024-01-15T10:00:00",
  "end": "2024-01-15T11:00:00",
  "eventType": "meeting"
}
```

### Contacts

```bash
# Listar contactos
GET /api/contacts?type=customer&search=juan

# Crear contacto
POST /api/contacts
{
  "firstName": "Juan",
  "lastName": "Pérez",
  "email": "juan@example.com",
  "type": "customer"
}
```

### CRM

```bash
# Listar leads
GET /api/crm/leads?status=new

# Crear lead
POST /api/crm/leads
{
  "firstName": "Cliente",
  "lastName": "Potencial",
  "email": "cliente@example.com",
  "source": "website",
  "status": "new"
}

# Crear deal
POST /api/crm/deals
{
  "name": "Venta importante",
  "value": 50000,
  "stage": "prospecting",
  "leadId": 1
}
```

### E-Commerce

```bash
# Listar productos
GET /api/ecommerce/products?status=active

# Crear producto
POST /api/ecommerce/products
{
  "name": "Producto",
  "price": 29.99,
  "stockQuantity": 100,
  "category": "Electronics"
}

# Crear orden
POST /api/ecommerce/orders
{
  "customerId": 1,
  "items": [
    {
      "productId": 1,
      "quantity": 2,
      "unitPrice": 29.99,
      "totalPrice": 59.98
    }
  ],
  "subtotal": 59.98,
  "totalAmount": 59.98
}
```

## 🔍 Filtros Comunes

Todos los endpoints de listado soportan:

- `page` - Número de página (default: 1)
- `limit` - Items por página (default: 10)
- `search` - Búsqueda de texto
- Filtros específicos por módulo

Ejemplo:
```
GET /api/todos?page=1&limit=20&status=pending&priority=high&search=importante
```

## 📊 Respuestas

### Respuesta Exitosa
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 100,
      "totalPages": 10
    }
  }
}
```

### Respuesta de Error
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [ ... ]
  }
}
```

## 🛠️ Herramientas Útiles

### Verificar Configuración
```bash
npm run verify
```

### Ejecutar Migraciones
```bash
npm run migrate
```

### Health Check
```bash
curl http://localhost:8000/api/healthz
```

## 📚 Documentación Completa

Ver `BACKEND_IMPLEMENTATION_SUMMARY.md` para documentación completa de todos los módulos.
