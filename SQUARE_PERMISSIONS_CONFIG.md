# Configuración de Permisos Square OAuth

## 📋 Permisos Necesarios para el Sistema

Basado en la documentación oficial de Square OAuth Permissions Reference, estos son los permisos que tu aplicación necesita:

### Permisos Requeridos

| Permiso | Para qué se usa | Endpoints |
|---------|----------------|-----------|
| **ITEMS_READ** | ✅ **REQUERIDO** - Leer catálogo de productos | `ListCatalog`, `SearchCatalogItems`, `RetrieveCatalogObject` |
| **ORDERS_READ** | ✅ **REQUERIDO** - Leer órdenes/ventas | `SearchOrders`, `BatchRetrieveOrders`, `RetrieveOrder` |
| **PAYMENTS_READ** | ✅ **REQUERIDO** - Leer pagos | `ListPayments`, `GetPayment`, `GetPaymentRefund` |
| **INVENTORY_READ** | ✅ **RECOMENDADO** - Leer inventario | `BatchRetrieveInventoryCounts`, `RetrieveInventoryCount` |

### Permisos Opcionales

| Permiso | Para qué se usa |
|---------|----------------|
| `ITEMS_WRITE` | Crear/editar productos en catálogo |
| `ORDERS_WRITE` | Crear/editar órdenes |
| `INVENTORY_WRITE` | Ajustar inventario (para waste tracking) |
| `CUSTOMERS_READ` | Leer información de clientes |

## 🔧 Cómo Configurar Permisos

### Paso 1: Square Developer Portal

1. Ve a: **https://developer.squareup.com**
2. Inicia sesión
3. Click en **"Applications"** → Selecciona tu aplicación
4. En el menú lateral, click en **"OAuth Permissions"**

### Paso 2: Habilitar Permisos

Activa estos permisos mínimos:

```
✅ ITEMS_READ        (Leer catálogo)
✅ ORDERS_READ       (Leer órdenes/ventas)
✅ PAYMENTS_READ     (Leer pagos)
✅ INVENTORY_READ    (Leer inventario)
```

### Paso 3: Obtener Access Token

**Para Sandbox (Desarrollo):**
1. En Square Developer Portal, ve a **"Sandbox Test Accounts"**
2. Copia el **Access Token** de tu cuenta de prueba
3. Copia el **Location ID**

**Para Producción:**
1. Necesitarás configurar OAuth flow completo
2. Los usuarios autorizarán tu app
3. Recibirás tokens OAuth por usuario

### Paso 4: Actualizar .env

```env
SQUARE_ACCESS_TOKEN=tu_access_token_aqui
SQUARE_ENVIRONMENT=sandbox  # o 'production'
SQUARE_LOCATION_ID=tu_location_id_aqui
```

## 📊 Endpoints que el Sistema Usa

### Catalog API (ITEMS_READ)
- ✅ `GET /v2/catalog/list` - Listar todos los items
- ✅ `POST /v2/catalog/search-catalog-items` - Buscar items

### Orders API (ORDERS_READ)
- ✅ `POST /v2/orders/search` - Buscar órdenes por fecha
- ✅ `POST /v2/orders/batch-retrieve` - Obtener múltiples órdenes

### Payments API (PAYMENTS_READ)
- ✅ `GET /v2/payments` - Listar pagos
- ✅ `GET /v2/payments/{id}` - Obtener pago específico

### Inventory API (INVENTORY_READ)
- ✅ `POST /v2/inventory/batch-retrieve-counts` - Obtener conteos de inventario
- ✅ `POST /v2/inventory/batch-retrieve-changes` - Obtener cambios de inventario

## 🔍 Verificar Permisos

### Test de Permisos

```bash
# Test Catalog (ITEMS_READ)
curl http://localhost:8000/api/square/catalog

# Test Orders (ORDERS_READ)
curl http://localhost:8000/api/square/sales?startDate=2024-01-01&endDate=2024-01-31

# Test Payments (PAYMENTS_READ)
curl http://localhost:8000/api/square/payments?startDate=2024-01-01&endDate=2024-01-31

# Test Inventory (INVENTORY_READ)
curl http://localhost:8000/api/square/inventory-all
```

### Logs del Backend

**Si los permisos están correctos:**
```
✅ Found 25 catalog items from Square (using ListCatalog API)
✅ Successfully fetched orders from Square
```

**Si faltan permisos:**
```
⚠️ Square API error: ACCESS_TOKEN_DOES_NOT_HAVE_ACCESS_TO_RESOURCE
💡 Tip: Ensure your Access Token has ITEMS_READ permission
```

## 📝 Referencia Completa de Permisos

Según Square OAuth Permissions Reference:

### Catalog API
- `ListCatalog`: **ITEMS_READ**
- `SearchCatalogItems`: **ITEMS_READ**
- `RetrieveCatalogObject`: **ITEMS_READ**
- `BatchRetrieveCatalogObjects`: **ITEMS_READ**
- `CreateCatalogImage`: **ITEMS_WRITE**
- `UpsertCatalogObject`: **ITEMS_WRITE**
- `DeleteCatalogObject`: **ITEMS_WRITE**

### Orders API
- `SearchOrders`: **ORDERS_READ**
- `BatchRetrieveOrders`: **ORDERS_READ**
- `RetrieveOrder`: **ORDERS_READ**
- `CreateOrder`: **ORDERS_WRITE**
- `UpdateOrder`: **ORDERS_WRITE**

### Payments API
- `ListPayments`: **PAYMENTS_READ**
- `GetPayment`: **PAYMENTS_READ**
- `GetPaymentRefund`: **PAYMENTS_READ**
- `CreatePayment`: **PAYMENTS_WRITE**
- `CancelPayment`: **PAYMENTS_WRITE**

### Inventory API
- `BatchRetrieveInventoryCounts`: **INVENTORY_READ**
- `BatchRetrieveInventoryChanges`: **INVENTORY_READ**
- `RetrieveInventoryCount`: **INVENTORY_READ**
- `BatchChangeInventory`: **INVENTORY_WRITE**

## 🎯 Permisos Recomendados para tu Aplicación

### Mínimo (Solo Lectura):
```
ITEMS_READ
ORDERS_READ
PAYMENTS_READ
INVENTORY_READ
```

### Completo (Lectura + Escritura):
```
ITEMS_READ
ITEMS_WRITE
ORDERS_READ
ORDERS_WRITE
PAYMENTS_READ
PAYMENTS_WRITE
INVENTORY_READ
INVENTORY_WRITE
CUSTOMERS_READ
```

## ✅ Checklist de Configuración

- [ ] Access Token configurado en `.env`
- [ ] Location ID configurado en `.env`
- [ ] Permisos habilitados en Square Developer Portal
- [ ] Items agregados en Square Dashboard (para tener catálogo)
- [ ] Probar endpoint `/api/square/catalog`
- [ ] Verificar logs del backend para confirmar conexión

---

**Referencia**: https://developer.squareup.com/docs/oauth-api/square-oauth-permissions
