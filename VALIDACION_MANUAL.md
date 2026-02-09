# Guía de validación manual — Cloudignite

**Objetivo:** Validar manualmente que todo el sistema funciona.

**Tiempo estimado:** 60–90 min (completa) | ~30 min (solo lo esencial)

**Cómo usar:** Sigue los pasos en orden y marca cada ítem. Opcional: abre **http://localhost:3000/validacion-checklist.html** para un checklist en el navegador (el estado se guarda). Si algo falla, usa [Diagnóstico](#si-encuentras-problemas).

---

## 📋 Preparación inicial

### Paso 0: Configuración del entorno

**Opción A — Un solo comando (recomendado):**
```bash
./start-all.sh
```
Backend en :8000, frontend en :3000. Luego abre **http://localhost:3000**.

**Opción B — Terminales separados:**
- **Terminal 1 (Backend):** `cd backend && npm install && npm run migrate && npm run dev`
- **Terminal 2 (Frontend):** `cd fila && python3 server.py`
- Abre **http://localhost:3000**

**Usuario de prueba (si no existe):**
```bash
./reset-demo.sh
# Credenciales: admin@test.com / admin123
```

---

## 🔐 Prueba 1: Autenticación

### 1.1 Registro
- [ ] Ir a **http://localhost:3000/sign-up.html**
- [ ] Completar: Company Name, Email, Password, First Name, Last Name
- [ ] Clic en **Sign Up**
- [ ] Comprobar redirección al dashboard
- [ ] Sin errores en consola (F12 → Console)

### 1.2 Login
- [ ] Cerrar sesión (menú usuario → Logout)
- [ ] Ir a **http://localhost:3000/sign-in.html**
- [ ] Ingresar email y contraseña
- [ ] Clic en **Sign In**
- [ ] Dashboard carga sin errores

### 1.3 Token en localStorage
- [ ] DevTools → Application → Local Storage
- [ ] Existen: `restaurant_cost_control_token`, `restaurant_cost_control_user`, `restaurant_cost_control_tenant`
- [ ] Valores no vacíos

---

## 📊 Prueba 2: Dashboard y métricas

### 2.1 Dashboard principal (index.html)
- [ ] Se muestran métricas (Food Cost %, Waste %, Savings, etc.)
- [ ] Gráficos cargan sin errores
- [ ] **Action Items** muestra elementos
- [ ] **Recently Captured Data** muestra datos (o mensaje claro si no hay)
- [ ] Botón **View breakdown** abre modal con cálculos
- [ ] Modal muestra desglose paso a paso

### 2.2 Cálculos
- [ ] Food Cost % entre 0–100
- [ ] Waste Cost número positivo (o 0)
- [ ] Prime Cost coherente (Food + Labor)
- [ ] Loss Summary con theoretical vs actual
- [ ] No "Loading..." ni "No data" indefinidos

---

## 📦 Prueba 3: Inventario

### 3.1 Inventory Control
- [ ] Sidebar → **Inventory Control** → `products-list.html`
- [ ] Tabla de productos visible
- [ ] Por fila: **View** (modal), **Edit** (formulario), **Delete** (confirmación)

### 3.2 CRUD inventario
- [ ] **+ Add Inventory Item** → formulario
- [ ] Crear: Item Name, Category, Quantity, Unit Cost → **Save**
- [ ] Nuevo ítem en tabla
- [ ] **Edit** → cambiar cantidad → **Update** → se refleja
- [ ] **Delete** → confirmar → ítem desaparece

### 3.3 Weekly Count
- [ ] Sidebar → **Weekly Count** → `inventory-count.html`
- [ ] Lista de ítems para contar
- [ ] Completar columnas **Counted**
- [ ] **Submit Count** → mensaje de éxito
- [ ] Stock actualizado (ver en Inventory Control)

---

## 🗑️ Prueba 4: Waste Tracking

### 4.1 Navegación
- [ ] Sidebar → **Waste Tracking** o **Manual Data Entry**
- [ ] O bien **http://localhost:3000/basic-elements.html**
- [ ] Sección **Record Waste** visible

### 4.2 Registrar waste
- [ ] Completar: Item, Quantity, Cost Value, Waste Date, Reason
- [ ] **Submit Waste Record**
- [ ] Mensaje de éxito
- [ ] **Recently Captured Waste** se actualiza

### 4.3 Waste analysis
- [ ] **http://localhost:3000/analytics.html**
- [ ] Sección **Waste Analysis** con gráficos
- [ ] Cambiar periodos (7 / 30 días) → gráficos se actualizan sin errores

---

## 📄 Prueba 5: Manual Data Entry

### 5.1 Subir invoice
- [ ] `basic-elements.html` → **Upload Invoice**
- [ ] **Choose File** → imagen (jpg/png) o PDF
- [ ] **Upload Invoice**
- [ ] Mensaje "Invoice processed" o similar
- [ ] **Recently Captured Invoices** muestra nuevo registro

### 5.2 Subir POS report
- [ ] **Upload POS Report**
- [ ] Archivo CSV o Excel
- [ ] **Upload POS Report**
- [ ] Mensaje de éxito
- [ ] **Recently Captured POS Reports** actualizado

### 5.3 Sync Square (opcional)
- [ ] **Sync Square Sales**
- [ ] Progreso o mensaje (puede requerir token Square configurado)

---

## 📱 Prueba 6: Apps

### 6.1 To Do List
- [ ] Sidebar → **To Do List** → `to-do-list.html`
- [ ] Lista de tareas (con datos demo si hay seed)
- [ ] Añadir, completar, editar, eliminar tarea
- [ ] Cambios persisten al recargar

### 6.2 Calendar
- [ ] **Calendar** → `calendar.html`
- [ ] Añadir evento (clic en fecha)
- [ ] Ver, editar, eliminar evento
- [ ] Cambiar vista Month / Week / Day

### 6.3 Contacts
- [ ] **Contacts** → `contacts.html`
- [ ] Lista de contactos
- [ ] Add, View, Edit, Delete contacto
- [ ] Búsqueda funciona

### 6.4 Chat
- [ ] **Chat**
- [ ] Lista de conversaciones
- [ ] Enviar mensaje, ver historial, crear chat

### 6.5 Email
- [ ] **Email**
- [ ] Inbox carga
- [ ] Ver email, redactar, responder

### 6.6 Kanban Board
- [ ] **Kanban Board**
- [ ] Mover tarjeta, añadir tarjeta, editar

### 6.7 File Manager
- [ ] **File Manager**
- [ ] Archivos y carpetas
- [ ] Subir archivo, crear carpeta, eliminar

---

## 🌐 Prueba 7: Pages

### 7.1 E-Commerce
- [ ] **E-Commerce** → productos
- [ ] Ver detalle, añadir al carrito, ver carrito, checkout (simulado)

### 7.2 CRM
- [ ] **CRM** → leads y deals
- [ ] Añadir lead, convertir a deal, actualizar etapa

### 7.3 Project Management
- [ ] **Project Management**
- [ ] Crear proyecto, añadir tarea, marcar completada

### 7.4 LMS
- [ ] **LMS** → cursos
- [ ] Ver curso, inscribirse, ver progreso

### 7.5 Help Desk
- [ ] **Help Desk** → tickets
- [ ] Crear ticket, comentar, cambiar estado

### 7.6 HR Management
- [ ] **HR Management**
- [ ] Lista empleados, registrar asistencia, solicitar tiempo libre

### 7.7 School, Hospital, Events, Social
- [ ] Navegar a cada uno
- [ ] Páginas cargan sin errores, datos demo visibles

---

## 🧪 Prueba 8: Tests automatizados

### 8.1 Suite exhaustiva
```bash
cd backend
npm run test:exhaustive-full
```
- [ ] Todos los tests pasan
- [ ] Se genera `reporte-pruebas.html`

### 8.2 Reporte
- [ ] Abrir **http://localhost:3000/reporte-pruebas.html**
- [ ] Pruebas en verde

### 8.3 Integridad BD
```bash
cd backend
npm run test:db-integrity
```
- [ ] Todos pasan

---

## 🚨 Prueba 9: Manejo de errores

### 9.1 Casos de error
- [ ] Login con credenciales incorrectas → mensaje de error
- [ ] Acceso sin login → redirección a `sign-in.html`
- [ ] Archivo muy grande (>10MB) → rechazo con mensaje claro
- [ ] Campos requeridos vacíos → validación previene envío

### 9.2 Mensajes
- [ ] Errores en lenguaje claro, sin detalles técnicos internos
- [ ] Sugerencias de solución cuando aplique

---

## ⚡ Prueba 10: Rendimiento y usabilidad

### 10.1 Tiempos de carga
- [ ] Dashboard &lt; 3 s
- [ ] Listas &lt; 2 s
- [ ] Modales y navegación rápidos

### 10.2 Responsive
- [ ] Reducir ventana → sidebar se adapta / menú hamburguesa
- [ ] Tablas con scroll, formularios se ajustan
- [ ] Usable en móvil

### 10.3 Accesibilidad básica
- [ ] Imágenes con `alt`
- [ ] Formularios con `label`
- [ ] Navegación con Tab

---

## 📊 Prueba 11: Reportes y analíticas

### 11.1 Reporte mensual
- [ ] **http://localhost:3000/reports.html**
- [ ] Seleccionar mes/año → **Generate Monthly Report**
- [ ] Ventas, costos, utilidad, comparación mes anterior

### 11.2 Product Margins
- [ ] Rango de fechas → tabla márgenes por producto
- [ ] Ordenar por margen

### 11.3 Supplier Ranking
- [ ] Ranking de proveedores por gasto
- [ ] Coherente con invoices

---

## 🔧 Prueba 12: Perfil y configuración

### 12.1 Perfil
- [ ] Menú usuario → **My Profile**
- [ ] **Edit Profile** → cambiar teléfono, dirección, etc.
- [ ] **Save** → cambios persisten

### 12.2 Settings
- [ ] Sidebar → **Settings**
- [ ] Revisar opciones (temas, etc.)

---

## ✅ Checklist final

Sistema validado cuando:

- [ ] **Login/Register** funciona
- [ ] **Dashboard** muestra métricas reales
- [ ] **Inventario** CRUD completo
- [ ] **Waste** registro y análisis
- [ ] **Manual Data Entry** (invoices, POS) operativo
- [ ] **Apps** (To Do, Calendar, Contacts, Chat, Email, Kanban, File Manager) funcionan
- [ ] **Pages** (E‑commerce, CRM, Projects, LMS, Help Desk, HR, etc.) cargan
- [ ] **Reportes** se generan
- [ ] **Tests automáticos** pasan
- [ ] **Base de datos** persiste datos
- [ ] **Errores** manejados de forma adecuada
- [ ] **Rendimiento** y **responsive** aceptables

---

## 🚨 Si encuentras problemas

1. **Consola del navegador** (F12 → Console): errores de red o JS.
2. **Servidores:** backend :8000, frontend :3000.
3. **Tests:** `npm run test:exhaustive-full` y `npm run test:db-integrity`.
4. **Logs del backend** en la terminal.
5. **Diagnóstico:** **http://localhost:3000/diagnose-connection.html** (reachability, CORS, DB).

---

## 🏆 Validación completada

Si has marcado todos los puntos relevantes y no hay bloqueos, el sistema Cloudignite está **listo para uso** (y para preparar producción según `deploy-guide.md` y `REPORTE_FINAL.md`).
