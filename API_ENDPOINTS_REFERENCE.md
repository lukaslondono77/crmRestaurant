# API Endpoints Reference - Square Integration

## 🔍 Endpoints para Verificar Items en Square

### 1. Obtener Catálogo Básico
```bash
GET http://localhost:8000/api/square/catalog
```

**Respuesta:**
```json
{
  "items": [
    {
      "id": "ITEM_ID",
      "name": "Item Name",
      "category": "CATEGORY_ID"
    }
  ]
}
```

**Ejemplo con curl:**
```bash
curl http://localhost:8000/api/square/catalog
```

---

### 2. Obtener Catálogo Detallado
```bash
GET http://localhost:8000/api/square/catalog-detailed
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "ITEM_ID",
        "name": "Item Name",
        "description": "Description",
        "variations": [
          {
            "id": "VARIATION_ID",
            "name": "Variation Name",
            "price": 12.95,
            "sku": "SKU-CODE"
          }
        ]
      }
    ],
    "totalItems": 100,
    "timestamp": "2024-01-20T..."
  }
}
```

**Ejemplo con curl:**
```bash
curl http://localhost:8000/api/square/catalog-detailed | python3 -m json.tool
```

---

### 3. Obtener Ventas de Square
```bash
GET http://localhost:8000/api/square/sales?startDate=2024-01-20&endDate=2024-01-20
```

**Parámetros:**
- `startDate` (opcional): Fecha inicio (YYYY-MM-DD)
- `endDate` (opcional): Fecha fin (YYYY-MM-DD)

**Ejemplo:**
```bash
curl "http://localhost:8000/api/square/sales?startDate=2024-01-20&endDate=2024-01-20"
```

---

### 4. Sincronizar Ventas de Hoy
```bash
POST http://localhost:8000/api/square/sync-today
```

**Ejemplo:**
```bash
curl -X POST http://localhost:8000/api/square/sync-today
```

---

### 5. Obtener Pagos
```bash
GET http://localhost:8000/api/square/payments?startDate=2024-01-20&endDate=2024-01-20
```

**Ejemplo:**
```bash
curl "http://localhost:8000/api/square/payments?startDate=2024-01-20&endDate=2024-01-20"
```

---

### 6. Obtener Inventario
```bash
GET http://localhost:8000/api/square/inventory-all
```

**Ejemplo:**
```bash
curl http://localhost:8000/api/square/inventory-all
```

---

### 7. Obtener Cambios de Inventario
```bash
GET http://localhost:8000/api/square/inventory-changes?startDate=2024-01-20&endDate=2024-01-20
```

**Ejemplo:**
```bash
curl "http://localhost:8000/api/square/inventory-changes?startDate=2024-01-20&endDate=2024-01-20"
```

---

## 📋 Endpoints de Recetas (BOM)

### 8. Obtener Todas las Recetas
```bash
GET http://localhost:8000/api/recipes
```

**Ejemplo:**
```bash
curl http://localhost:8000/api/recipes | python3 -m json.tool
```

---

### 9. Obtener Receta Específica
```bash
GET http://localhost:8000/api/recipes/#ITEM_MOLE_POBLANO
```

**Ejemplo:**
```bash
curl http://localhost:8000/api/recipes/%23ITEM_MOLE_POBLANO
```

---

### 10. Calcular Costo de Receta
```bash
GET http://localhost:8000/api/recipes/#ITEM_MOLE_POBLANO/cost
```

**Ejemplo:**
```bash
curl http://localhost:8000/api/recipes/%23ITEM_MOLE_POBLANO/cost | python3 -m json.tool
```

---

## 🔧 Endpoints de Importación

### 11. Importar Menú
```bash
POST http://localhost:8000/api/square/import-menu
```

**Ejemplo:**
```bash
curl -X POST http://localhost:8000/api/square/import-menu
```

---

### 12. Importar Inventario
```bash
POST http://localhost:8000/api/square/import-inventory
```

**Ejemplo:**
```bash
curl -X POST http://localhost:8000/api/square/import-inventory
```

---

### 13. Importar Todo (Menú + Inventario)
```bash
POST http://localhost:8000/api/square/import-all
```

**Ejemplo:**
```bash
curl -X POST http://localhost:8000/api/square/import-all
```

---

### 14. Establecer Inventario Inicial
```bash
POST http://localhost:8000/api/square/set-initial-inventory
```

**Ejemplo:**
```bash
curl -X POST http://localhost:8000/api/square/set-initial-inventory
```

---

## 🌐 Endpoints Directos de Square API

### 15. List Catalog (Square API Directa)
```bash
GET https://connect.squareupsandbox.com/v2/catalog/list?types=ITEM,ITEM_VARIATION
```

**Headers requeridos:**
```
Square-Version: 2024-01-18
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json
```

**Ejemplo:**
```bash
curl -H "Square-Version: 2024-01-18" \
     -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
     -H "Content-Type: application/json" \
     "https://connect.squareupsandbox.com/v2/catalog/list?types=ITEM,ITEM_VARIATION"
```

---

## 📊 Scripts de Verificación

### Verificar Items con Script
```bash
cd backend
node scripts/check-square-items.js
```

### Verificar Importación
```bash
cd backend
node scripts/import-menu.js all
```

---

## 🔍 Verificación Rápida

**Comando todo-en-uno para verificar:**
```bash
# Verificar catálogo
echo "📦 Catálogo:" && \
curl -s http://localhost:8000/api/square/catalog-detailed | \
python3 -c "import sys, json; d = json.load(sys.stdin); print(f\"Items: {len(d.get('data', {}).get('items', []))}\")"

# Verificar recetas
echo "📋 Recetas:" && \
curl -s http://localhost:8000/api/recipes | \
python3 -c "import sys, json; d = json.load(sys.stdin); print(f\"Recetas: {len(d.get('data', []))}\")"
```

---

## 🛠️ Troubleshooting

### Si el backend no responde:
```bash
# Verificar que el backend esté corriendo
curl http://localhost:8000/api/healthz
```

### Si hay errores de autenticación:
- Verifica que `SQUARE_ACCESS_TOKEN` esté en `.env`
- Verifica que el token tenga permisos `ITEMS_READ`

### Si no hay items:
- Ejecuta: `node scripts/import-menu.js all`
- Verifica los logs del backend

---

## 📝 Notas

- Todos los endpoints usan el puerto **8000** por defecto
- Los endpoints de Square usan **Sandbox** por defecto
- Para producción, cambia `squareupsandbox.com` a `squareup.com`
- Los IDs de items pueden necesitar encoding URL (`%23` para `#`)

---

## Dashboard — Metrics (period-aligned P&L)

### GET /api/dashboard/metrics

Returns dashboard metrics for a **single reporting period** so that purchases, sales, waste, and labor are all for the same date range. Avoids misleading "last 4 days" comparisons.

**Query:** `period` (optional) — `weekly` | `monthly` | `quarterly`. Default: `weekly`.

**Example:** `GET /api/dashboard/metrics?period=weekly`

**Response includes:** `period` (startDate, endDate, label, dayCount), `sales`, `totalCost`, `grossProfit`, `isProfitable`, `foodCostPercent`, `targetFoodCostPercent`, `primeCostPercent`, `dailyBurnRate`, `breakdown` (purchases, sales, waste, labor), `crisisIndicators`, `periodInfo` (for UI labels), and legacy-compat fields.

---

## Dashboard — Owner View (Executive Summary)

### GET /api/dashboard/executive-summary

Returns the Owner View payload: crisis banner, Priority 1 Today action, and 4-card executive summary. Requires authentication.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "crisisBanner": {
      "visible": true,
      "severity": "red",
      "message": "Prime Cost has been over 68% for 3 days.",
      "rule": "PRIME_COST_3_DAYS"
    },
    "priorityOne": {
      "id": "REDUCE_WASTE",
      "title": "Reduce Waste",
      "description": "Waste is 8.2% of sales this period.",
      "actionLabel": "Reduce Waste →",
      "actionUrl": "/#/reports",
      "potentialSavings": 1200,
      "category": "Waste"
    },
    "cards": {
      "dailyBurnRate": { "value": 120, "label": "Daily Burn Rate", "periodDays": 2 },
      "projectedMonthlyPandL": { "value": -3600, "isLoss": true, "label": "Projected Monthly P&L" },
      "topCostDriver": { "name": "Food cost overrun", "value": 800, "label": "Top Cost Driver" },
      "foodCostVsGoal": { "current": 32.5, "goal": 28, "delta": 4.5, "overGoal": true }
    },
    "period": { "start": "2025-02-01", "end": "2025-02-02", "label": "Last 2 Days" }
  }
}
```

**Frontend:** Owner View page at `fila/owner-view.html` consumes this endpoint.

---

**Base URL:** `http://localhost:8000`
**Square Sandbox:** `https://connect.squareupsandbox.com`
**Square Production:** `https://connect.squareup.com`
