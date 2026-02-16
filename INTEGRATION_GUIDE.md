# Frontend-Backend Integration Guide

## 🔗 Integración del Frontend con el Backend

## Session Notes (2026-02-10)

- Full local setup and fixes for this session are documented in:
  - `TODAY_2026-02-10_SETUP_AND_FIXES.md`
- Includes:
  - everything changed today,
  - login/test credentials,
  - exact startup commands and recommended run flow.

### Configuración del API Service

El archivo `fila/assets/js/api/apiService.js` ya está configurado con todos los métodos necesarios.

### Configuración Base

```javascript
// El API Service está configurado para usar:
const API_BASE_URL = 'http://localhost:8000/api';

// Y maneja automáticamente:
// - Tokens JWT en headers
// - Manejo de errores
// - Respuestas estandarizadas
```

### Ejemplo de Uso en el Frontend

#### 1. Iniciar Sesión

```javascript
// En tu página de login
async function handleLogin(email, password) {
  try {
    const response = await apiService.login(email, password);
    
    if (response.success) {
      // Guardar token
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      
      // Redirigir al dashboard
      window.location.href = '/dashboard.html';
    }
  } catch (error) {
    console.error('Error de login:', error);
    // Mostrar error al usuario
  }
}
```

#### 2. Obtener Datos del Dashboard

```javascript
// En dashboard.html
async function loadDashboard() {
  try {
    const response = await apiService.getDashboardSummary();
    
    if (response.success) {
      const data = response.data;
      
      // Actualizar UI
      document.getElementById('total-revenue').textContent = data.totalRevenue;
      document.getElementById('food-cost').textContent = data.foodCost;
      // ... más actualizaciones
    }
  } catch (error) {
    console.error('Error cargando dashboard:', error);
  }
}

// Llamar al cargar la página
document.addEventListener('DOMContentLoaded', loadDashboard);
```

#### 3. Crear un Todo

```javascript
async function createTodo() {
  const todoData = {
    title: document.getElementById('todo-title').value,
    description: document.getElementById('todo-description').value,
    priority: document.getElementById('todo-priority').value,
    status: 'pending'
  };
  
  try {
    const response = await apiService.createTodo(todoData);
    
    if (response.success) {
      // Actualizar lista de todos
      loadTodos();
      // Limpiar formulario
      document.getElementById('todo-form').reset();
    }
  } catch (error) {
    console.error('Error creando todo:', error);
  }
}
```

#### 4. Listar con Paginación

```javascript
async function loadTodos(page = 1) {
  try {
    const response = await apiService.getTodos({
      page: page,
      limit: 10,
      status: 'pending'
    });
    
    if (response.success) {
      const todos = response.data.data;
      const pagination = response.data.meta.pagination;
      
      // Renderizar todos
      renderTodos(todos);
      
      // Renderizar paginación
      renderPagination(pagination);
    }
  } catch (error) {
    console.error('Error cargando todos:', error);
  }
}
```

### Manejo de Autenticación

#### Verificar si el usuario está autenticado

```javascript
// Al cargar cualquier página protegida
function checkAuth() {
  const token = localStorage.getItem('token');
  
  if (!token) {
    // Redirigir al login
    window.location.href = '/sign-in.html';
    return false;
  }
  
  // El API Service usa automáticamente el token
  return true;
}
```

#### Cerrar Sesión

```javascript
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/sign-in.html';
}
```

### Ejemplos por Módulo

#### Calendar

```javascript
// Cargar eventos del calendario
async function loadCalendarEvents(start, end) {
  const response = await apiService.getCalendarEvents({
    startDate: start,
    endDate: end
  });
  
  if (response.success) {
    // Usar con FullCalendar.js
    calendar.addEventSource(response.data);
  }
}

// Crear evento
async function createEvent(eventData) {
  const response = await apiService.createCalendarEvent(eventData);
  if (response.success) {
    calendar.addEvent(response.data);
  }
}
```

#### CRM

```javascript
// Cargar leads
async function loadLeads() {
  const response = await apiService.getCrmLeads({
    status: 'new',
    page: 1,
    limit: 20
  });
  
  if (response.success) {
    renderLeadsTable(response.data.data);
  }
}

// Crear lead
async function createLead(leadData) {
  const response = await apiService.createCrmLead(leadData);
  if (response.success) {
    loadLeads(); // Recargar lista
  }
}
```

#### E-Commerce

```javascript
// Cargar productos
async function loadProducts() {
  const response = await apiService.getEcommerceProducts({
    status: 'active',
    page: 1,
    limit: 12
  });
  
  if (response.success) {
    renderProducts(response.data.data);
  }
}

// Agregar al carrito
async function addToCart(productId, quantity) {
  const cart = await apiService.getEcommerceCart();
  const response = await apiService.addToEcommerceCart(
    cart.data.id,
    productId,
    quantity
  );
  
  if (response.success) {
    updateCartUI(response.data);
  }
}
```

### Manejo de Errores

```javascript
// Función helper para manejar errores de API
function handleApiError(error) {
  if (error.response) {
    // Error de respuesta del servidor
    const errorData = error.response.data;
    
    if (errorData.error.code === 'UNAUTHORIZED') {
      // Token expirado o inválido
      logout();
      return;
    }
    
    // Mostrar mensaje de error al usuario
    showNotification(errorData.error.message, 'error');
  } else {
    // Error de red
    showNotification('Error de conexión. Intenta de nuevo.', 'error');
  }
}

// Usar en try-catch
try {
  const response = await apiService.getTodos();
  // ...
} catch (error) {
  handleApiError(error);
}
```

### Actualizar API Base URL

Si el backend está en un servidor diferente:

```javascript
// En apiService.js, cambiar:
const API_BASE_URL = 'https://tu-servidor.com/api';

// O usar variable de entorno:
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8000/api';
```

### Notificaciones

```javascript
// Función helper para mostrar notificaciones
function showNotification(message, type = 'info') {
  // Usar tu librería de notificaciones preferida
  // Ejemplo con Toastr, SweetAlert, etc.
  
  if (type === 'success') {
    toastr.success(message);
  } else if (type === 'error') {
    toastr.error(message);
  } else {
    toastr.info(message);
  }
}

// Usar después de operaciones
const response = await apiService.createTodo(todoData);
if (response.success) {
  showNotification('Todo creado exitosamente', 'success');
}
```

### Loading States

```javascript
// Mostrar/ocultar loading
function setLoading(isLoading) {
  const loader = document.getElementById('loader');
  if (isLoading) {
    loader.style.display = 'block';
  } else {
    loader.style.display = 'none';
  }
}

// Usar en funciones async
async function loadData() {
  setLoading(true);
  try {
    const response = await apiService.getTodos();
    // Procesar datos
  } finally {
    setLoading(false);
  }
}
```

## 🎯 Mejores Prácticas

1. **Siempre verificar autenticación** antes de hacer llamadas API
2. **Manejar errores** apropiadamente
3. **Mostrar feedback** al usuario (loading, success, error)
4. **Validar datos** antes de enviar al backend
5. **Usar paginación** para listas grandes
6. **Cachear datos** cuando sea apropiado
7. **Actualizar UI** después de operaciones exitosas

## 📝 Notas

- El API Service maneja automáticamente los tokens JWT
- Todas las respuestas siguen el formato estándar: `{ success, data, meta }`
- Los errores se manejan de forma consistente
- La paginación está disponible en todos los endpoints de listado
