# Guía de Square Dashboard - Tequila's Town

## 📋 Pasos para Verificar Items Importados

### 1. Ver Items Importados

**En Square Dashboard:**
1. Haz clic en **"Items & services"** en el menú lateral izquierdo
2. Deberías ver tus items organizados por categorías:
   - **Menú items** (36 items):
     - APPETIZERS (Empanadas, Nachos, Guacamole, etc.)
     - SO MEXICAN (Tortas, Sopes)
     - SOUPS & SALADS
     - TEX MEX / BOWLS
     - STREET STYLE TACOS
     - HOUSE SPECIALS (Mole Poblano, Chile Relleno)
     - SEAFOOD
     - PARRILLADA (Fajitas)
     - LITTLE AMIGOS
     - DESSERTS
     - SIDES
     - DRINKS
   
   - **Inventory items** (30 items):
     - SPICES & DRIED HERBS (12 especias)
     - MEAT & POULTRY (4 items)
     - DAIRY & CHEESE (2 items)
     - VEGETABLES
     - TORTILLAS & WRAPS
     - SEAFOOD - RAW

### 2. Verificar Detalles de un Item

**Para cada item, verifica:**
- ✅ Nombre correcto
- ✅ Precio configurado
- ✅ SKU único (ej: `APP-EMP-BEEF`, `SPC-GUA-LB`)
- ✅ Categoría asignada
- ✅ Descripción (para items de menú)

**Ejemplo - Empanadas:**
- Nombre: "EMPANADAS"
- Precios: $9.95 (Beef), $9.95 (Chicken), $8.95 (Cheese)
- SKUs: `APP-EMP-BEEF`, `APP-EMP-CHKN`, `APP-EMP-QF`
- Categoría: APPETIZERS

### 3. Establecer Inventario Inicial (Opcional)

**Método Manual:**
1. Ve a **"Items & services"** → **"Inventory"**
2. Busca cada item de inventario
3. Haz clic en el item
4. Establece la cantidad inicial
5. Guarda

**Items críticos a configurar:**
- Chile Guajillo: 5 lb
- Chile Ancho: 8 lb
- Orégano Mexicano: 24 oz
- Carne Asada: 25 lb
- Pollo Desmenuzado: 18 lb
- Queso Fresco: 15 lb
- Tortillas de Maíz: 10 packs
- Aguacates: 4 cases

### 4. Crear Orden de Prueba

**Para generar datos de ventas:**

1. Haz clic en **"Take a payment"** (botón grande en la página principal)
   - O desde el menú lateral: **"Payments & invoices"** → **"Take payment"**

2. Crea una orden de prueba:
   - Selecciona algunos items del menú:
     - 2x Empanadas (Beef) - $19.90
     - 1x Tacos Al Pastor (3 tacos) - $12.95
     - 1x Horchata - $3.95
   - Total: ~$36.80

3. Completa el pago como "Cash" o "Card" (test)

4. **Importante:** Esto generará datos que puedes ver en:
   - Square Dashboard → Reports
   - Tu aplicación usando "Sync from Square"

### 5. Verificar Permisos de API

**Si vas a usar la integración automática:**

1. Ve a [Square Developer Portal](https://developer.squareup.com/apps)
2. Selecciona tu aplicación
3. Verifica que tengas estos permisos:
   - ✅ `ITEMS_READ` - Para leer catálogo
   - ✅ `ITEMS_WRITE` - Para crear/actualizar items
   - ✅ `INVENTORY_READ` - Para leer inventario
   - ✅ `INVENTORY_WRITE` - Para actualizar inventario (opcional)
   - ✅ `ORDERS_READ` - Para leer órdenes/ventas
   - ✅ `PAYMENTS_READ` - Para leer pagos

### 6. Verificar Reports

**Después de crear órdenes de prueba:**

1. Ve a **"Reports"** en el menú lateral
2. Verás datos de:
   - Ventas netas
   - Transacciones
   - Items más vendidos
   - Promedio de venta

### 7. Sincronizar con Tu Aplicación

**Desde tu aplicación:**

1. Ve a la página de "Sync from Square"
2. Haz clic en "Sync Today's Sales"
3. Los datos de Square aparecerán en tu dashboard:
   - Ventas del día
   - Items vendidos
   - Ingresos totales

## 🔍 Troubleshooting

### No veo los items importados

**Posibles causas:**
1. **Categorías ocultas:** Verifica que estés viendo "All items"
2. **Filtros activos:** Limpia cualquier filtro de búsqueda
3. **Items sin categoría:** Algunos items pueden estar sin categoría asignada

**Solución:**
- Usa la búsqueda para encontrar items por nombre
- Verifica en "All items" que no haya filtros aplicados

### Los SKUs no aparecen

**Verificación:**
1. Abre un item
2. Ve a "Variations"
3. Verifica que cada variación tenga SKU configurado

**Si no tienen SKU:**
- Los items se importaron correctamente
- Los SKUs pueden no ser visibles en la UI pero están en la API
- El sistema funcionará igual

### No puedo establecer inventario

**Si no ves opciones de inventario:**
1. Verifica que el item tenga "Track inventory" habilitado
2. Algunos planes de Square tienen limitaciones de inventario
3. Puedes usar la API para establecer inventario

## 📱 Próximos Pasos

1. ✅ Verificar items en Square Dashboard
2. ✅ Crear 2-3 órdenes de prueba
3. ✅ Sincronizar desde tu aplicación
4. ✅ Ver datos en tu dashboard de costos
5. ✅ Probar sistema de recetas y costos

## 💡 Tips

- **Organiza por categorías:** Los items están organizados por categorías para fácil navegación
- **Usa búsqueda:** Square tiene búsqueda rápida para encontrar items
- **Exportar datos:** Puedes exportar reportes desde Square para análisis adicionales
- **Test con órdenes pequeñas:** Crea órdenes de prueba primero antes de producción

---

**¿Necesitas ayuda?** Todos los items fueron importados correctamente. Si no los ves, verifica los filtros o usa la búsqueda por nombre.
