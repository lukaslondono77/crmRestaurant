# Guía: Cómo Usar el Catálogo de Square

## 📋 ¿Dónde está el catálogo de Square?

El catálogo de Square es donde almacenas todos tus productos/menu items. Hay dos formas de acceder:

### Opción 1: Dashboard de Square (Recomendado para agregar items)
1. Ve a: **https://squareup.com/dashboard** (o https://squareupsandbox.com para Sandbox)
2. Inicia sesión con tu cuenta de Square
3. En el menú lateral, busca **"Items"** o **"Productos"**
4. Ahí puedes agregar, editar y ver todos tus items del menú
5. Cada item puede tener:
   - Nombre
   - Precio
   - Categoría
   - Variaciones (tamaños, tipos, etc.)
   - Descripción
   - Imágenes

### Opción 2: Square Developer Portal (Para configurar permisos)
1. Ve a: **https://developer.squareup.com**
2. Inicia sesión
3. Ve a **"Applications"** y selecciona tu app
4. En **"OAuth Permissions"**, asegúrate de tener:
   - ✅ `ITEMS_READ` - Para leer el catálogo
   - ✅ `ORDERS_READ` - Para leer órdenes
   - ✅ `PAYMENTS_READ` - Para leer pagos
   - ✅ `INVENTORY_READ` - Para leer inventario

## 🔧 Configuración Actual

### Verificar tu configuración:
Tu archivo `.env` debería tener:
```env
SQUARE_ACCESS_TOKEN=tu_token_aqui
SQUARE_ENVIRONMENT=sandbox  # o 'production'
SQUARE_LOCATION_ID=tu_location_id
```

### Obtener tu Access Token:
1. Ve a https://developer.squareup.com
2. Selecciona tu aplicación
3. En "Credentials", copia tu **Access Token**
4. En "Sandbox Test Accounts", copia tu **Location ID** si estás en sandbox

## 📊 Cómo Funciona el Sistema

### Flujo Automático:
```
1. Sistema intenta obtener catálogo de Square
   ↓
2. Si Square tiene items → Usa esos items reales
   ↓
3. Si Square no tiene items o falla → Usa 14 items simulados
```

### Métodos que el sistema intenta (en orden):
1. **searchCatalogItems()** - API moderna de Square
2. **listCatalog()** - API tradicional de Square
3. **Direct API Call** - Llamada HTTP directa como último recurso
4. **Datos simulados** - Si todo falla, usa menú predeterminado

## ✅ Cómo Agregar Items a Square (Sandbox)

### Paso 1: Agregar Items Manualmente
1. Ve a https://squareupsandbox.com/dashboard
2. Inicia sesión
3. Click en **"Items"** en el menú
4. Click **"+ Add item"**
5. Completa:
   - Nombre: "Grilled Chicken Plate"
   - Precio: $18.99
   - Categoría: "Main Courses"
6. Guarda

### Paso 2: Verificar que se Sincronice
1. En tu aplicación, ve a la página de sincronización
2. Click en "Sync from Square"
3. Revisa los logs del backend para ver:
   - `✅ Found X catalog items via...` = Éxito
   - `⚠️ All catalog methods failed` = Problema de conexión

## 🧪 Probar la Conexión

### Endpoint de prueba:
```bash
# Ver catálogo desde Square
curl http://localhost:8000/api/square/catalog

# Ver catálogo detallado
curl http://localhost:8000/api/square/catalog-detailed
```

### Respuestas esperadas:

**Si Square está conectado:**
```json
{
  "items": [
    {
      "id": "...",
      "name": "Grilled Chicken Plate",
      "variations": [...]
    }
  ]
}
```

**Si Square no está conectado:**
```json
{
  "items": [],
  "totalItems": 0
}
```

## 🔍 Verificar Logs del Backend

Cuando sincronizas, busca en los logs del servidor:

```
✅ Using 25 real catalog items from Square for simulated data
```
= Usando datos reales de Square ✅

```
⚠️ Could not fetch Square catalog, using default menu items
```
= Usando datos simulados (14 items) ⚠️

## 📝 Checklist de Configuración

- [ ] Access Token configurado en `.env`
- [ ] Location ID configurado en `.env`
- [ ] Environment configurado (sandbox/production)
- [ ] Permisos OAuth activados (ITEMS_READ)
- [ ] Items agregados en Square Dashboard
- [ ] Backend ejecutándose (`npm run dev`)
- [ ] Probar endpoint `/api/square/catalog`

## 🆘 Problemas Comunes

### "No catalog items found"
**Causa**: No hay items en tu catálogo de Square
**Solución**: Agrega items en Square Dashboard

### "Authentication failed"
**Causa**: Access Token inválido o sin permisos
**Solución**: 
1. Regenera el token en Square Developer Portal
2. Verifica que tenga permisos ITEMS_READ

### "Location ID not found"
**Causa**: Location ID incorrecto
**Solución**: 
1. Obtén el Location ID correcto de Square Dashboard
2. Actualiza `.env` con el ID correcto

## 💡 Nota Importante

**Datos Simulados vs Datos Reales:**

- **Líneas 115-134** en `squareService.js` = Datos simulados (fallback)
- Estos solo se usan si Square no está disponible
- Si Square está conectado y tiene items, se usan esos items reales
- Los datos simulados son solo para demostración

---

**Última actualización**: 2026-01-19
