# Dashboard Data Flow - Square Integration

## 📊 Flujo de Datos: Square → Dashboard

### 1. Sincronización desde Square

```
POST /api/square/sync-today
    ↓
Square API → Obtiene ventas/items
    ↓
Backend procesa datos
    ↓
Guarda en Base de Datos:
  - Tabla: sales (ventas generales)
  - Tabla: sales_items (items vendidos)
```

### 2. Dashboard Carga Datos

El dashboard (`index.html`) carga datos desde múltiples endpoints:

#### A. Métricas Generales
```javascript
GET /api/dashboard/metrics
```
- Calcula: weekly loss, food cost %, waste %
- Usa datos de: `sales`, `invoices`, `waste`
- Se muestra en: Cards principales del dashboard

#### B. Items de Inventario (Highest Cost)
```javascript
GET /api/invoices
```
- Lee desde: Tabla `invoices` y `invoice_items`
- Se muestra en: "Highest Cost Inventory Items" table
- Agrupa items por nombre y suma costos

#### C. Top Suppliers
```javascript
GET /api/analytics/supplier-ranking
```
- Calcula: Proveedores con más gastos
- Se muestra en: "Top Suppliers" list

#### D. Recent Cost Issues
```javascript
GET /api/waste (waste records)
GET /api/invoices (high cost invoices)
```
- Combina: Waste records + High cost invoices
- Se muestra en: "Recent Cost Issues" table

#### E. Transactions History
```javascript
GET /api/invoices
GET /api/waste
```
- Combina: Purchases (negativas) + Waste losses
- Se muestra en: "Transactions History" table

### 3. Datos de Square en el Dashboard

**Los datos de Square aparecen en:**

1. **Métricas principales** (desde `/api/dashboard/metrics`)
   - Calculadas usando datos de la tabla `sales` (que incluye datos de Square)

2. **Transactions History** (indirectamente)
   - Los datos de Square se guardan como "sales" en la DB
   - Se pueden mostrar como transacciones positivas (ventas)

3. **Items vendidos** (desde `sales_items`)
   - Los items de Square se guardan en `sales_items` con sus nombres
   - Se usan para calcular métricas y reportes

## 🔄 Proceso Completo

```
┌─────────────────────────────────────┐
│  Square Dashboard                   │
│  (Crea órdenes de prueba)           │
└──────────────┬──────────────────────┘
               │
               ↓
┌─────────────────────────────────────┐
│  POST /api/square/sync-today        │
│  (Sincroniza desde Square)          │
└──────────────┬──────────────────────┘
               │
               ↓
┌─────────────────────────────────────┐
│  Backend procesa y guarda:          │
│  - sales table (ventas)              │
│  - sales_items table (items)         │
└──────────────┬──────────────────────┘
               │
               ↓
┌─────────────────────────────────────┐
│  Dashboard carga al abrir:           │
│  - GET /api/dashboard/metrics       │
│  - GET /api/pos/reports             │
│  - GET /api/invoices                │
└──────────────┬──────────────────────┘
               │
               ↓
┌─────────────────────────────────────┐
│  Frontend muestra datos:            │
│  - Cards con métricas               │
│  - Tablas con items/transacciones   │
│  - Gráficos y análisis              │
└─────────────────────────────────────┘
```

## ✅ Verificación

**Para verificar que los datos están llegando al dashboard:**

1. **Sincroniza desde Square:**
   ```bash
   curl -X POST http://localhost:8000/api/square/sync-today
   ```

2. **Verifica datos en DB:**
   ```bash
   curl http://localhost:8000/api/pos/reports
   ```

3. **Abre el dashboard:**
   - Ve a `fila/index.html` en tu navegador
   - Los datos deberían aparecer automáticamente
   - Si no aparecen, refresca la página (F5)

## 🔧 Troubleshooting

### Los datos no aparecen en el dashboard

**Causas posibles:**
1. Backend no está corriendo
2. Datos no se sincronizaron correctamente
3. Dashboard no está cargando (revisa consola del navegador)

**Solución:**
1. Verifica backend: `curl http://localhost:8000/api/healthz`
2. Sincroniza de nuevo: `curl -X POST http://localhost:8000/api/square/sync-today`
3. Refresca el dashboard (F5)
4. Revisa consola del navegador (F12) para errores

### Los nombres aparecen como "Unknown"

**Causa:** Parsing incorrecto de datos de Square (ya corregido)

**Solución:**
1. Sincroniza de nuevo después de la corrección
2. Los nuevos datos tendrán nombres correctos
3. Los datos antiguos con "Unknown" permanecerán hasta que se sincronice de nuevo

## 📝 Notas Importantes

- **Los datos se guardan en la base de datos local** (SQLite)
- **El dashboard lee desde la DB, no directamente de Square**
- **Cada sync actualiza/crea nuevos registros en la DB**
- **El dashboard se actualiza automáticamente al cargar la página**

---

**Resumen:** Sí, los datos de Square SÍ van al dashboard, pero pasan por la base de datos primero. El dashboard no consulta Square directamente, sino que lee los datos que ya fueron sincronizados y guardados en la DB.
