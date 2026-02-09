# Troubleshooting - Items No Visibles en Square Dashboard

## 🔍 Problema
Los items fueron importados exitosamente (66 items según los logs), pero no aparecen en Square Dashboard.

## ✅ Verificación: Los Items SÍ Están en Square
- La API confirma que hay **100 items** en Square
- Los items fueron importados correctamente según los logs

## 🎯 Soluciones

### 1. Refrescar la Página
- Presiona `Cmd+R` (Mac) o `Ctrl+R` (Windows) para refrescar
- O cierra y vuelve a abrir el navegador

### 2. Buscar Items Específicos
En Square Dashboard:
1. Ve a **"Items & services"** → **"Item library"**
2. Usa la **barra de búsqueda** (arriba)
3. Busca por nombre:
   - "EMPANADAS"
   - "TACOS"
   - "CHILE"
   - "QUESO"

### 3. Verificar Filtros
1. En "Item library", busca controles de filtro
2. Asegúrate de que:
   - No haya filtros de categoría activos
   - No estés en vista de "Archived" o "Draft"
   - Estés viendo "All items" o "Active items"

### 4. Verificar Ubicación (Location)
1. Verifica que estés viendo la ubicación correcta
2. En Square Dashboard, verifica tu Location ID
3. Los items pueden estar asociados a una ubicación específica

### 5. Verificar desde la API Directamente

**Opción A: Usar tu aplicación**
```bash
# Desde tu backend
curl http://localhost:8000/api/square/catalog-detailed
```

**Opción B: Verificar en Square Developer Portal**
1. Ve a https://developer.squareup.com/apps
2. Selecciona tu aplicación
3. Ve a "Logs" para ver las operaciones de catalog

### 6. Re-importar (si es necesario)

Si después de todo lo anterior no ves los items:

```bash
cd backend
node scripts/import-menu.js all
```

## 🔧 Verificación Rápida

**En Square Dashboard, intenta:**

1. **Buscar "EMPANADAS"** en la barra de búsqueda
2. **Buscar "TACOS"** 
3. **Buscar "CHILE"** (debería mostrar las especias)

Si la búsqueda encuentra los items, entonces están ahí pero quizás hay un problema de visualización en la lista principal.

## 📱 Alternativa: Crear Items Manualmente

Si prefieres empezar de otra forma:

1. En Square Dashboard → "Items & services" → "Create an item"
2. Crea 2-3 items de prueba manualmente
3. Luego usa "Sync from Square" en tu aplicación para verificar la integración

## 💡 Próximos Pasos

1. ✅ Refresca la página
2. ✅ Busca items por nombre específico
3. ✅ Verifica que no haya filtros activos
4. ✅ Si aún no aparecen, prueba crear 1 item manualmente para verificar que el dashboard funciona

## 🆘 Si Nada Funciona

**Contacta Square Support** o verifica:
- ¿Estás en Square Sandbox o Production?
- ¿Tu Access Token tiene permisos ITEMS_READ?
- ¿Los items están en otra cuenta/location?

---

**Nota:** Los items están en Square según la API. El problema es de visualización en el Dashboard, no de importación.
