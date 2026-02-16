/**
 * API Service for Restaurant Cost Control Platform
 * Base URL: Configurable via environment or config
 */

// Detect environment and set API base URL
function getApiBaseUrl() {
  // Priority 1: Check for global config (set in HTML)
  if (window.APP_CONFIG && window.APP_CONFIG.API_BASE_URL) {
    return window.APP_CONFIG.API_BASE_URL;
  }
  
  // Priority 2: Check for environment variable (if using build process)
  if (typeof process !== 'undefined' && process.env && process.env.API_BASE_URL) {
    return process.env.API_BASE_URL;
  }
  
  // Priority 3: Auto-detect based on current host
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  const port = window.location.port;
  
  // Production detection (no localhost, no port 3000/8000)
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
    // Production: use same origin or configured API domain
    return `${protocol}//${hostname}${port ? ':' + port : ''}/api`;
  }
  
  // Development: default to localhost:8000
  return 'http://localhost:8000/api';
}

const API_BASE_URL = getApiBaseUrl();

class ApiService {
  /**
   * Get authorization header with token
   */
  getAuthHeaders() {
    const token = window.authService?.getToken();
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }

  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const authHeaders = this.getAuthHeaders();
    
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
        ...options.headers
      },
      ...options
    };

    try {
      const response = await fetch(url, config);
      
      // Check if response is HTML (error page) instead of JSON
      const contentType = response.headers.get('content-type');
      let data;
      
      if (contentType && contentType.includes('text/html')) {
        const htmlText = await response.text();
        console.error('❌ Server returned HTML instead of JSON');
        console.error('Response preview:', htmlText.substring(0, 500));
        console.error('Full URL:', url);
        console.error('Status:', response.status, response.statusText);
        
        // Provide helpful error message
        let errorMsg = `Server returned HTML instead of JSON. `;
        if (response.status === 404) {
          errorMsg += `Endpoint ${endpoint} not found. `;
        } else if (response.status === 500) {
          errorMsg += `Server error (500). `;
        }
        errorMsg += `Please check: 1) Backend server is running, 2) Endpoint exists, 3) CORS is configured correctly.`;
        
        const error = new Error(errorMsg);
        error.isHtmlResponse = true;
        error.status = response.status;
        throw error;
      }
      
      // Try to parse as JSON
      try {
        const text = await response.text();
        if (!text || text.trim() === '') {
          throw new Error('Empty response from server');
        }
        data = JSON.parse(text);
      } catch (parseError) {
        console.error('❌ Failed to parse JSON response');
        console.error('Response text:', parseError);
        throw new Error(`Invalid JSON response from server. The endpoint may not exist or returned an error page.`);
      }

      // Handle 401 Unauthorized - token expired or invalid
      if (response.status === 401) {
        if (window.authService) {
          console.warn('⚠️ 401 Unauthorized - clearing auth data and redirecting to login');
          window.authService.clearAuthData();
          // Only redirect if not already on login page
          const currentPage = window.location.pathname.split('/').pop();
          if (currentPage !== 'sign-in.html' && currentPage !== 'sign-up.html') {
            window.location.href = 'sign-in.html';
          }
        }
        throw new Error('Session expired. Please login again.');
      }

      // Even if status is not ok, check if we have success=true (for warnings with simulated data)
      if (!response.ok && !data.success) {
        let errorMessage = 'Request failed';
        if (data.error) {
          if (typeof data.error === 'string') {
            errorMessage = data.error;
          } else if (data.error.message) {
            errorMessage = data.error.message;
          } else if (data.error.code) {
            errorMessage = `${data.error.code}: ${data.error.message || 'Unknown error'}`;
          }
        } else if (data.message) {
          errorMessage = data.message;
        }
        const err = new Error(errorMessage);
        err.status = response.status;
        err.code = data.code;
        throw err;
      }

      // Return data even if there's a warning (for simulated data cases)
      return data;
    } catch (error) {
      // Handle network errors gracefully
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        const friendlyError = new Error('Backend server is not running. Please start the backend server with: cd backend && npm run dev');
        friendlyError.name = 'NetworkError';
        friendlyError.isNetworkError = true;
        console.warn('⚠️ API Network Error:', friendlyError.message);
        throw friendlyError;
      }
      
      // Log error details for debugging
      console.error('API Error:', error.message || error);
      if (error.stack) {
        console.error('Stack:', error.stack);
      }
      throw error;
    }
  }

  /**
   * Upload POS Report
   */
  async uploadPOSReport(file, formData) {
    const token = window.authService?.getToken();
    const data = new FormData();
    data.append('image', file);
    if (formData) {
      Object.keys(formData).forEach(key => {
        if (formData[key] !== null && formData[key] !== undefined) {
          data.append(key, formData[key]);
        }
      });
    }

    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/pos/upload`, {
      method: 'POST',
      headers: headers,
      body: data
    });

    if (response.status === 401) {
      if (window.authService) {
        window.authService.clearAuthData();
        window.location.href = 'sign-in.html';
      }
      throw new Error('Session expired. Please login again.');
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || error.error || 'Failed to upload POS report');
    }

    return await response.json();
  }

  /**
   * Upload Invoice
   */
  async uploadInvoice(file, formData) {
    const token = window.authService?.getToken();
    const data = new FormData();
    data.append('image', file);
    if (formData) {
      Object.keys(formData).forEach(key => {
        if (formData[key] !== null && formData[key] !== undefined) {
          data.append(key, formData[key]);
        }
      });
    }

    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/invoices/upload`, {
      method: 'POST',
      headers: headers,
      body: data
    });

    if (response.status === 401) {
      if (window.authService) {
        window.authService.clearAuthData();
        window.location.href = 'sign-in.html';
      }
      throw new Error('Session expired. Please login again.');
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || error.error || 'Failed to upload invoice');
    }

    return await response.json();
  }

  /**
   * Record Waste
   */
  async recordWaste(wasteData, file = null) {
    const token = window.authService?.getToken();
    const data = new FormData();
    if (file) {
      data.append('image', file);
    }
    Object.keys(wasteData).forEach(key => {
      if (wasteData[key] !== null && wasteData[key] !== undefined) {
        data.append(key, wasteData[key]);
      }
    });

    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/waste`, {
      method: 'POST',
      headers: headers,
      body: data
    });

    if (response.status === 401) {
      if (window.authService) {
        window.authService.clearAuthData();
        window.location.href = 'sign-in.html';
      }
      throw new Error('Session expired. Please login again.');
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || error.error || 'Failed to record waste');
    }

    return await response.json();
  }

  /**
   * Get Dashboard Metrics
   */
  async getDashboardMetrics(period) {
    const qs = period ? '?period=' + encodeURIComponent(period) : '';
    return this.request('/dashboard/metrics' + qs);
  }

  /**
   * Get Executive Summary (Owner View: crisis banner, Priority 1, 4-card summary)
   */
  async getExecutiveSummary() {
    return this.request('/dashboard/executive-summary');
  }

  async getActionItems() {
    return this.request('/dashboard/action-items');
  }

  async getMonthlyReport(year, month) {
    const params = new URLSearchParams();
    if (year) params.append('year', year);
    if (month) params.append('month', month);
    return this.request(`/dashboard/monthly-report?${params.toString()}`);
  }

  /**
   * Get Waste Analysis
   */
  async getWasteAnalysis(startDate, endDate) {
    return this.request(`/dashboard/waste-analysis?startDate=${startDate}&endDate=${endDate}`);
  }

  /**
   * Get Slow Moving Items
   */
  async getSlowMovingItems(days = 7) {
    return this.request(`/dashboard/slow-moving?days=${days}`);
  }

  /**
   * Get Recent POS Reports
   */
  async getPOSReports() {
    return this.request('/pos/reports');
  }

  /**
   * Get Recent Invoices
   */
  async getInvoices() {
    return this.request('/invoices');
  }

  /**
   * Get Waste Records
   */
  async getWasteRecords(startDate, endDate) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return this.request(`/waste?${params.toString()}`);
  }

  /**
   * Sync today's sales from Square API
   */
  async syncSquareSales() {
    return this.request('/square/sync-today', {
      method: 'POST'
    });
  }

  /**
   * Get sales data from Square for date range
   */
  async getSquareSales(startDate, endDate) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return this.request(`/square/sales?${params.toString()}`);
  }

  /**
   * Get payments data from Square
   */
  async getSquarePayments(startDate, endDate) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return this.request(`/square/payments?${params.toString()}`);
  }

  /**
   * Get product margins report
   */
  async getProductMargins(startDate, endDate) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return this.request(`/analytics/product-margins?${params.toString()}`);
  }

  /**
   * Get trends analysis
   */
  async getTrends(periodType = 'weekly', periods = 4) {
    const params = new URLSearchParams();
    params.append('periodType', periodType);
    params.append('periods', periods);
    return this.request(`/analytics/trends?${params.toString()}`);
  }

  /**
   * Get supplier ranking
   */
  async getSupplierRanking(startDate, endDate) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return this.request(`/analytics/suppliers?${params.toString()}`);
  }

  /**
   * Compare periods performance
   */
  async comparePeriods(period1Start, period1End, period2Start, period2End) {
    const params = new URLSearchParams();
    params.append('period1Start', period1Start);
    params.append('period1End', period1End);
    params.append('period2Start', period2Start);
    params.append('period2End', period2End);
    return this.request(`/analytics/compare?${params.toString()}`);
  }

  /**
   * Get expiring items alerts
   */
  async getAlerts(daysAhead = 7) {
    const params = new URLSearchParams();
    params.append('daysAhead', daysAhead);
    return this.request(`/analytics/alerts?${params.toString()}`);
  }

  // Get payments from Square
  async getSquarePayments(startDate, endDate) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return this.request(`/square/payments?${params.toString()}`);
  }

  // Get all inventory counts
  async getSquareInventoryAll(catalogObjectIds = []) {
    const params = new URLSearchParams();
    if (catalogObjectIds.length > 0) {
      params.append('catalogObjectIds', catalogObjectIds.join(','));
    }
    return this.request(`/square/inventory-all?${params.toString()}`);
  }

  // Get detailed catalog
  async getSquareCatalogDetailed() {
    return this.request('/square/catalog-detailed');
  }

  // Get inventory changes (movements)
  async getSquareInventoryChanges(startDate, endDate, catalogObjectIds = []) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (catalogObjectIds.length > 0) {
      params.append('catalogObjectIds', catalogObjectIds.join(','));
    }
    return this.request(`/square/inventory-changes?${params.toString()}`);
  }

  /**
   * Get all inventory items
   */
  async getInventory(filters = {}) {
    const params = new URLSearchParams();
    if (filters.category) params.append('category', filters.category);
    if (filters.lowStock) params.append('lowStock', 'true');
    if (filters.threshold) params.append('threshold', filters.threshold);
    if (filters.page) params.append('page', filters.page);
    if (filters.limit) params.append('limit', filters.limit);
    return this.request(`/inventory?${params.toString()}`);
  }

  /**
   * Get low stock items
   */
  async getLowStockItems(threshold = 10) {
    const params = new URLSearchParams();
    if (threshold) params.append('threshold', threshold);
    return this.request(`/inventory/low-stock?${params.toString()}`);
  }

  /**
   * Get single inventory item
   */
  async getInventoryItem(id) {
    return this.request(`/inventory/${id}`);
  }

  /**
   * Create new inventory item
   */
  async createInventoryItem(itemData) {
    return this.request('/inventory', {
      method: 'POST',
      body: JSON.stringify(itemData)
    });
  }

  /**
   * Update inventory item
   */
  async updateInventoryItem(id, itemData) {
    return this.request(`/inventory/${id}`, {
      method: 'PUT',
      body: JSON.stringify(itemData)
    });
  }

  /**
   * Delete inventory item
   */
  async deleteInventoryItem(id) {
    return this.request(`/inventory/${id}`, {
      method: 'DELETE'
    });
  }

  /**
   * Get items to include in weekly inventory count (inventory + purchase_items)
   */
  async getInventoryCountItems() {
    return this.request('/inventory/counts/items');
  }

  /**
   * Get weekly inventory counts. weekEnd: YYYY-MM-DD (default: last Sunday)
   */
  async getInventoryCounts(weekEnd) {
    const params = new URLSearchParams();
    if (weekEnd) params.append('weekEnd', weekEnd);
    return this.request(`/inventory/counts?${params.toString()}`);
  }

  /**
   * Submit weekly inventory count. { countDate, items: [ { itemName, quantity, unitPrice?, category?, notes? } ] }
   */
  async submitInventoryCount(payload) {
    return this.request('/inventory/counts', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  /**
   * Get action items requiring attention
   */
  async getActionItems() {
    return this.request('/dashboard/action-items');
  }

  /**
   * Get labor cost analysis
   */
  async getLaborCost(startDate, endDate) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return this.request(`/dashboard/labor-cost?${params.toString()}`);
  }

  /**
   * Get menu profitability analysis
   */
  async getMenuProfitability(startDate, endDate) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return this.request(`/dashboard/menu-profitability?${params.toString()}`);
  }

  /**
   * Get variance detection analysis
   */
  async getVariance(startDate, endDate) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return this.request(`/dashboard/variance?${params.toString()}`);
  }

  /**
   * Get available reports
   */
  async getAvailableReports() {
    return this.request('/dashboard/reports');
  }

  /**
   * Export report data
   */
  async exportReport(reportType, format = 'json', startDate, endDate) {
    return this.request('/dashboard/export', {
      method: 'POST',
      body: JSON.stringify({ reportType, format, startDate, endDate })
    });
  }

  /**
   * Get all alerts (expiring items, low stock, etc.)
   */
  async getAllAlerts() {
    return this.request('/dashboard/alerts');
  }

  /**
   * To Do List Methods
   */

  /**
   * Get all todos with filters
   */
  async getTodos(filters = {}) {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.priority) params.append('priority', filters.priority);
    if (filters.assignedTo) params.append('assignedTo', filters.assignedTo);
    if (filters.userId) params.append('userId', filters.userId);
    if (filters.category) params.append('category', filters.category);
    if (filters.dueDateFrom) params.append('dueDateFrom', filters.dueDateFrom);
    if (filters.dueDateTo) params.append('dueDateTo', filters.dueDateTo);
    if (filters.overdue) params.append('overdue', filters.overdue);
    if (filters.search) params.append('search', filters.search);
    if (filters.orderBy) params.append('orderBy', filters.orderBy);
    if (filters.page) params.append('page', filters.page);
    if (filters.limit) params.append('limit', filters.limit);
    return this.request(`/todos?${params.toString()}`);
  }

  /**
   * Get todo statistics
   */
  async getTodoStats(filters = {}) {
    const params = new URLSearchParams();
    if (filters.userId) params.append('userId', filters.userId);
    if (filters.assignedTo) params.append('assignedTo', filters.assignedTo);
    return this.request(`/todos/stats?${params.toString()}`);
  }

  /**
   * Get single todo by ID
   */
  async getTodo(id) {
    return this.request(`/todos/${id}`);
  }

  /**
   * Create new todo
   */
  async createTodo(todoData) {
    return this.request('/todos', {
      method: 'POST',
      body: JSON.stringify(todoData)
    });
  }

  /**
   * Update todo
   */
  async updateTodo(id, updateData) {
    return this.request(`/todos/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updateData)
    });
  }

  /**
   * Update todo status only
   */
  async updateTodoStatus(id, status) {
    return this.request(`/todos/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
  }

  /**
   * Delete todo
   */
  async deleteTodo(id) {
    return this.request(`/todos/${id}`, {
      method: 'DELETE'
    });
  }

  /**
   * Calendar Methods
   */

  /**
   * Get all calendar events with filters
   */
  async getCalendarEvents(filters = {}) {
    const params = new URLSearchParams();
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.eventType) params.append('eventType', filters.eventType);
    if (filters.status) params.append('status', filters.status);
    if (filters.userId) params.append('userId', filters.userId);
    if (filters.category) params.append('category', filters.category);
    if (filters.allDay !== undefined) params.append('allDay', filters.allDay);
    if (filters.search) params.append('search', filters.search);
    if (filters.orderBy) params.append('orderBy', filters.orderBy);
    if (filters.page) params.append('page', filters.page);
    if (filters.limit) params.append('limit', filters.limit);
    return this.request(`/calendar/events?${params.toString()}`);
  }

  /**
   * Get events for date range (for calendar view)
   */
  async getCalendarEventsByRange(startDate, endDate, filters = {}) {
    const params = new URLSearchParams();
    params.append('startDate', startDate);
    params.append('endDate', endDate);
    if (filters.eventType) params.append('eventType', filters.eventType);
    if (filters.status) params.append('status', filters.status);
    if (filters.userId) params.append('userId', filters.userId);
    return this.request(`/calendar/events/range?${params.toString()}`);
  }

  /**
   * Get upcoming events
   */
  async getUpcomingEvents(limit = 10, filters = {}) {
    const params = new URLSearchParams();
    params.append('limit', limit);
    if (filters.userId) params.append('userId', filters.userId);
    if (filters.eventType) params.append('eventType', filters.eventType);
    return this.request(`/calendar/events/upcoming?${params.toString()}`);
  }

  /**
   * Get calendar statistics
   */
  async getCalendarStats(filters = {}) {
    const params = new URLSearchParams();
    if (filters.userId) params.append('userId', filters.userId);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    return this.request(`/calendar/stats?${params.toString()}`);
  }

  /**
   * Get single calendar event by ID
   */
  async getCalendarEvent(id) {
    return this.request(`/calendar/events/${id}`);
  }

  /**
   * Create new calendar event
   */
  async createCalendarEvent(eventData) {
    return this.request('/calendar/events', {
      method: 'POST',
      body: JSON.stringify(eventData)
    });
  }

  /**
   * Update calendar event
   */
  async updateCalendarEvent(id, updateData) {
    return this.request(`/calendar/events/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updateData)
    });
  }

  /**
   * Update calendar event status only
   */
  async updateCalendarEventStatus(id, status) {
    return this.request(`/calendar/events/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
  }

  /**
   * Delete calendar event
   */
  async deleteCalendarEvent(id) {
    return this.request(`/calendar/events/${id}`, {
      method: 'DELETE'
    });
  }

  /**
   * Contacts Methods
   */

  /**
   * Get all contacts with filters
   */
  async getContacts(filters = {}) {
    const params = new URLSearchParams();
    if (filters.contactType) params.append('contactType', filters.contactType);
    if (filters.status) params.append('status', filters.status);
    if (filters.userId) params.append('userId', filters.userId);
    if (filters.company) params.append('company', filters.company);
    if (filters.search) params.append('search', filters.search);
    if (filters.orderBy) params.append('orderBy', filters.orderBy);
    if (filters.page) params.append('page', filters.page);
    if (filters.limit) params.append('limit', filters.limit);
    return this.request(`/contacts?${params.toString()}`);
  }

  /**
   * Get contact statistics
   */
  async getContactStats(filters = {}) {
    const params = new URLSearchParams();
    if (filters.userId) params.append('userId', filters.userId);
    return this.request(`/contacts/stats?${params.toString()}`);
  }

  /**
   * Get single contact by ID
   */
  async getContact(id) {
    return this.request(`/contacts/${id}`);
  }

  /**
   * Create new contact
   */
  async createContact(contactData) {
    return this.request('/contacts', {
      method: 'POST',
      body: JSON.stringify(contactData)
    });
  }

  /**
   * Update contact
   */
  async updateContact(id, updateData) {
    return this.request(`/contacts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updateData)
    });
  }

  /**
   * Delete contact
   */
  async deleteContact(id) {
    return this.request(`/contacts/${id}`, {
      method: 'DELETE'
    });
  }

  /**
   * Chat Methods
   */

  /**
   * Get all conversations for current user
   */
  async getChatConversations(filters = {}) {
    const params = new URLSearchParams();
    if (filters.page) params.append('page', filters.page);
    if (filters.limit) params.append('limit', filters.limit);
    return this.request(`/chat/conversations?${params.toString()}`);
  }

  /**
   * Get single conversation by ID
   */
  async getChatConversation(id) {
    return this.request(`/chat/conversations/${id}`);
  }

  /**
   * Get or create direct conversation with another user
   */
  async getOrCreateDirectConversation(userId) {
    return this.request('/chat/conversations/direct', {
      method: 'POST',
      body: JSON.stringify({ userId })
    });
  }

  /**
   * Create group conversation
   */
  async createGroupConversation(name, participantIds) {
    return this.request('/chat/conversations/group', {
      method: 'POST',
      body: JSON.stringify({ name, participantIds })
    });
  }

  /**
   * Get messages for a conversation
   */
  async getChatMessages(conversationId, filters = {}) {
    const params = new URLSearchParams();
    if (filters.page) params.append('page', filters.page);
    if (filters.limit) params.append('limit', filters.limit);
    return this.request(`/chat/conversations/${conversationId}/messages?${params.toString()}`);
  }

  /**
   * Send message to conversation
   */
  async sendChatMessage(conversationId, messageData) {
    return this.request(`/chat/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify(messageData)
    });
  }

  /**
   * Mark messages as read
   */
  async markChatMessagesAsRead(conversationId) {
    return this.request(`/chat/conversations/${conversationId}/read`, {
      method: 'PATCH'
    });
  }

  /**
   * Delete message
   */
  async deleteChatMessage(messageId) {
    return this.request(`/chat/messages/${messageId}`, {
      method: 'DELETE'
    });
  }

  /**
   * Get unread message count
   */
  async getChatUnreadCount() {
    return this.request('/chat/unread-count');
  }

  /**
   * Email Methods
   */

  /**
   * Get all emails with filters
   */
  async getEmails(filters = {}) {
    const params = new URLSearchParams();
    if (filters.folder) params.append('folder', filters.folder);
    if (filters.status) params.append('status', filters.status);
    if (filters.isDraft !== undefined) params.append('isDraft', filters.isDraft);
    if (filters.isStarred !== undefined) params.append('isStarred', filters.isStarred);
    if (filters.isImportant !== undefined) params.append('isImportant', filters.isImportant);
    if (filters.search) params.append('search', filters.search);
    if (filters.orderBy) params.append('orderBy', filters.orderBy);
    if (filters.page) params.append('page', filters.page);
    if (filters.limit) params.append('limit', filters.limit);
    return this.request(`/emails?${params.toString()}`);
  }

  /**
   * Get email statistics
   */
  async getEmailStats() {
    return this.request('/emails/stats');
  }

  /**
   * Get single email by ID
   */
  async getEmail(id) {
    return this.request(`/emails/${id}`);
  }

  /**
   * Create/send email
   */
  async createEmail(emailData) {
    const formData = new FormData();
    Object.keys(emailData).forEach(key => {
      if (key === 'attachments' && Array.isArray(emailData[key])) {
        emailData[key].forEach(file => {
          formData.append('attachments', file);
        });
      } else if (key !== 'attachments') {
        formData.append(key, typeof emailData[key] === 'object' ? JSON.stringify(emailData[key]) : emailData[key]);
      }
    });

    const token = this.getAuthHeaders()['Authorization'];
    return fetch(`${API_BASE_URL}/emails`, {
      method: 'POST',
      headers: token ? { 'Authorization': token } : {},
      body: formData
    }).then(res => res.json());
  }

  /**
   * Update email
   */
  async updateEmail(id, updateData) {
    return this.request(`/emails/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updateData)
    });
  }

  /**
   * Delete email (move to trash)
   */
  async deleteEmail(id) {
    return this.request(`/emails/${id}`, {
      method: 'DELETE'
    });
  }

  /**
   * Permanently delete email
   */
  async permanentlyDeleteEmail(id) {
    return this.request(`/emails/${id}/permanent`, {
      method: 'DELETE'
    });
  }

  /**
   * Kanban Board Methods
   */

  /**
   * Get all boards
   */
  async getKanbanBoards(filters = {}) {
    const params = new URLSearchParams();
    if (filters.userId) params.append('userId', filters.userId);
    if (filters.isArchived !== undefined) params.append('isArchived', filters.isArchived);
    if (filters.search) params.append('search', filters.search);
    if (filters.page) params.append('page', filters.page);
    if (filters.limit) params.append('limit', filters.limit);
    return this.request(`/kanban/boards?${params.toString()}`);
  }

  /**
   * Get board with columns and cards
   */
  async getKanbanBoard(id) {
    return this.request(`/kanban/boards/${id}`);
  }

  /**
   * Create board
   */
  async createKanbanBoard(boardData) {
    return this.request('/kanban/boards', {
      method: 'POST',
      body: JSON.stringify(boardData)
    });
  }

  /**
   * Update board
   */
  async updateKanbanBoard(id, updateData) {
    return this.request(`/kanban/boards/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updateData)
    });
  }

  /**
   * Delete board
   */
  async deleteKanbanBoard(id) {
    return this.request(`/kanban/boards/${id}`, {
      method: 'DELETE'
    });
  }

  /**
   * Create column
   */
  async createKanbanColumn(boardId, columnData) {
    return this.request(`/kanban/boards/${boardId}/columns`, {
      method: 'POST',
      body: JSON.stringify(columnData)
    });
  }

  /**
   * Update column
   */
  async updateKanbanColumn(id, updateData) {
    return this.request(`/kanban/columns/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updateData)
    });
  }

  /**
   * Delete column
   */
  async deleteKanbanColumn(id) {
    return this.request(`/kanban/columns/${id}`, {
      method: 'DELETE'
    });
  }

  /**
   * Create card
   */
  async createKanbanCard(boardId, cardData) {
    return this.request(`/kanban/boards/${boardId}/cards`, {
      method: 'POST',
      body: JSON.stringify(cardData)
    });
  }

  /**
   * Get card
   */
  async getKanbanCard(id) {
    return this.request(`/kanban/cards/${id}`);
  }

  /**
   * Update card
   */
  async updateKanbanCard(id, updateData) {
    return this.request(`/kanban/cards/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updateData)
    });
  }

  /**
   * Move card to different column
   */
  async moveKanbanCard(id, columnId, position) {
    return this.request(`/kanban/cards/${id}/move`, {
      method: 'PATCH',
      body: JSON.stringify({ columnId, position })
    });
  }

  /**
   * Delete card
   */
  async deleteKanbanCard(id) {
    return this.request(`/kanban/cards/${id}`, {
      method: 'DELETE'
    });
  }

  /**
   * File Manager Methods
   */

  /**
   * Get all folders
   */
  async getFileFolders(filters = {}) {
    const params = new URLSearchParams();
    if (filters.parentFolderId !== undefined) params.append('parentFolderId', filters.parentFolderId);
    if (filters.isArchived !== undefined) params.append('isArchived', filters.isArchived);
    if (filters.search) params.append('search', filters.search);
    return this.request(`/files/folders?${params.toString()}`);
  }

  /**
   * Get folder by ID
   */
  async getFileFolder(id) {
    return this.request(`/files/folders/${id}`);
  }

  /**
   * Create folder
   */
  async createFileFolder(folderData) {
    return this.request('/files/folders', {
      method: 'POST',
      body: JSON.stringify(folderData)
    });
  }

  /**
   * Update folder
   */
  async updateFileFolder(id, updateData) {
    return this.request(`/files/folders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updateData)
    });
  }

  /**
   * Delete folder
   */
  async deleteFileFolder(id) {
    return this.request(`/files/folders/${id}`, {
      method: 'DELETE'
    });
  }

  /**
   * Get all files
   */
  async getFiles(filters = {}) {
    const params = new URLSearchParams();
    if (filters.folderId !== undefined) params.append('folderId', filters.folderId);
    if (filters.userId) params.append('userId', filters.userId);
    if (filters.isArchived !== undefined) params.append('isArchived', filters.isArchived);
    if (filters.isStarred !== undefined) params.append('isStarred', filters.isStarred);
    if (filters.fileType) params.append('fileType', filters.fileType);
    if (filters.search) params.append('search', filters.search);
    if (filters.page) params.append('page', filters.page);
    if (filters.limit) params.append('limit', filters.limit);
    return this.request(`/files?${params.toString()}`);
  }

  /**
   * Get file statistics
   */
  async getFileStats(filters = {}) {
    const params = new URLSearchParams();
    if (filters.userId) params.append('userId', filters.userId);
    return this.request(`/files/stats?${params.toString()}`);
  }

  /**
   * Get file by ID
   */
  async getFile(id) {
    return this.request(`/files/${id}`);
  }

  /**
   * Upload file
   */
  async uploadFile(file, folderId, description, tags) {
    const formData = new FormData();
    formData.append('file', file);
    if (folderId) formData.append('folderId', folderId);
    if (description) formData.append('description', description);
    if (tags) formData.append('tags', JSON.stringify(tags));

    const token = this.getAuthHeaders()['Authorization'];
    return fetch(`${API_BASE_URL}/files/upload`, {
      method: 'POST',
      headers: token ? { 'Authorization': token } : {},
      body: formData
    }).then(res => res.json());
  }

  /**
   * Update file
   */
  async updateFile(id, updateData) {
    return this.request(`/files/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updateData)
    });
  }

  /**
   * Delete file
   */
  async deleteFile(id) {
    return this.request(`/files/${id}`, {
      method: 'DELETE'
    });
  }

  /**
   * Share file or folder
   */
  async shareFile(fileId, folderId, sharedWith, permission = 'view', expiresAt) {
    return this.request('/files/share', {
      method: 'POST',
      body: JSON.stringify({ fileId, folderId, sharedWith, permission, expiresAt })
    });
  }

  /**
   * E-Commerce Methods
   */

  /**
   * Get all products
   */
  async getEcommerceProducts(filters = {}) {
    const params = new URLSearchParams();
    if (filters.categoryId) params.append('categoryId', filters.categoryId);
    if (filters.status) params.append('status', filters.status);
    if (filters.featured !== undefined) params.append('featured', filters.featured);
    if (filters.lowStock) params.append('lowStock', filters.lowStock);
    if (filters.search) params.append('search', filters.search);
    if (filters.page) params.append('page', filters.page);
    if (filters.limit) params.append('limit', filters.limit);
    return this.request(`/ecommerce/products?${params.toString()}`);
  }

  /**
   * Get product by ID
   */
  async getEcommerceProduct(id) {
    return this.request(`/ecommerce/products/${id}`);
  }

  /**
   * Create product
   */
  async createEcommerceProduct(productData) {
    return this.request('/ecommerce/products', {
      method: 'POST',
      body: JSON.stringify(productData)
    });
  }

  /**
   * Update product
   */
  async updateEcommerceProduct(id, updateData) {
    return this.request(`/ecommerce/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updateData)
    });
  }

  /**
   * Delete product
   */
  async deleteEcommerceProduct(id) {
    return this.request(`/ecommerce/products/${id}`, {
      method: 'DELETE'
    });
  }

  /**
   * Get categories
   */
  async getEcommerceCategories() {
    return this.request('/ecommerce/categories');
  }

  /**
   * Create category
   */
  async createEcommerceCategory(categoryData) {
    return this.request('/ecommerce/categories', {
      method: 'POST',
      body: JSON.stringify(categoryData)
    });
  }

  /**
   * Get orders
   */
  async getEcommerceOrders(filters = {}) {
    const params = new URLSearchParams();
    if (filters.paymentStatus) params.append('paymentStatus', filters.paymentStatus);
    if (filters.fulfillmentStatus) params.append('fulfillmentStatus', filters.fulfillmentStatus);
    if (filters.customerId) params.append('customerId', filters.customerId);
    if (filters.search) params.append('search', filters.search);
    if (filters.page) params.append('page', filters.page);
    if (filters.limit) params.append('limit', filters.limit);
    return this.request(`/ecommerce/orders?${params.toString()}`);
  }

  /**
   * Get order by ID
   */
  async getEcommerceOrder(id) {
    return this.request(`/ecommerce/orders/${id}`);
  }

  /**
   * Create order
   */
  async createEcommerceOrder(orderData) {
    return this.request('/ecommerce/orders', {
      method: 'POST',
      body: JSON.stringify(orderData)
    });
  }

  /**
   * Update order status
   */
  async updateEcommerceOrderStatus(id, updateData) {
    return this.request(`/ecommerce/orders/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify(updateData)
    });
  }

  /**
   * Get or create cart
   */
  async getEcommerceCart(sessionId) {
    const params = new URLSearchParams();
    if (sessionId) params.append('sessionId', sessionId);
    return this.request(`/ecommerce/cart?${params.toString()}`);
  }

  /**
   * Add item to cart
   */
  async addToEcommerceCart(cartId, productId, quantity = 1) {
    return this.request('/ecommerce/cart/items', {
      method: 'POST',
      body: JSON.stringify({ cartId, productId, quantity })
    });
  }

  /**
   * Remove item from cart
   */
  async removeFromEcommerceCart(cartId, itemId) {
    return this.request(`/ecommerce/cart/items/${itemId}?cartId=${cartId}`, {
      method: 'DELETE'
    });
  }

  /**
   * CRM Methods
   */

  /**
   * Get all leads
   */
  async getCrmLeads(filters = {}) {
    const params = new URLSearchParams();
    if (filters.userId) params.append('userId', filters.userId);
    if (filters.status) params.append('status', filters.status);
    if (filters.source) params.append('source', filters.source);
    if (filters.search) params.append('search', filters.search);
    if (filters.page) params.append('page', filters.page);
    if (filters.limit) params.append('limit', filters.limit);
    return this.request(`/crm/leads?${params.toString()}`);
  }

  /**
   * Get lead by ID
   */
  async getCrmLead(id) {
    return this.request(`/crm/leads/${id}`);
  }

  /**
   * Create lead
   */
  async createCrmLead(leadData) {
    return this.request('/crm/leads', {
      method: 'POST',
      body: JSON.stringify(leadData)
    });
  }

  /**
   * Update lead
   */
  async updateCrmLead(id, updateData) {
    return this.request(`/crm/leads/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updateData)
    });
  }

  /**
   * Delete lead
   */
  async deleteCrmLead(id) {
    return this.request(`/crm/leads/${id}`, {
      method: 'DELETE'
    });
  }

  /**
   * Get all deals
   */
  async getCrmDeals(filters = {}) {
    const params = new URLSearchParams();
    if (filters.userId) params.append('userId', filters.userId);
    if (filters.stage) params.append('stage', filters.stage);
    if (filters.leadId) params.append('leadId', filters.leadId);
    if (filters.search) params.append('search', filters.search);
    if (filters.page) params.append('page', filters.page);
    if (filters.limit) params.append('limit', filters.limit);
    return this.request(`/crm/deals?${params.toString()}`);
  }

  /**
   * Get deal by ID
   */
  async getCrmDeal(id) {
    return this.request(`/crm/deals/${id}`);
  }

  /**
   * Create deal
   */
  async createCrmDeal(dealData) {
    return this.request('/crm/deals', {
      method: 'POST',
      body: JSON.stringify(dealData)
    });
  }

  /**
   * Update deal
   */
  async updateCrmDeal(id, updateData) {
    return this.request(`/crm/deals/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updateData)
    });
  }

  /**
   * Delete deal
   */
  async deleteCrmDeal(id) {
    return this.request(`/crm/deals/${id}`, {
      method: 'DELETE'
    });
  }

  /**
   * Get activities
   */
  async getCrmActivities(filters = {}) {
    const params = new URLSearchParams();
    if (filters.leadId) params.append('leadId', filters.leadId);
    if (filters.dealId) params.append('dealId', filters.dealId);
    if (filters.contactId) params.append('contactId', filters.contactId);
    if (filters.activityType) params.append('activityType', filters.activityType);
    if (filters.isCompleted !== undefined) params.append('isCompleted', filters.isCompleted);
    if (filters.page) params.append('page', filters.page);
    if (filters.limit) params.append('limit', filters.limit);
    return this.request(`/crm/activities?${params.toString()}`);
  }

  /**
   * Create activity
   */
  async createCrmActivity(activityData) {
    return this.request('/crm/activities', {
      method: 'POST',
      body: JSON.stringify(activityData)
    });
  }

  /**
   * Update activity
   */
  async updateCrmActivity(id, updateData) {
    return this.request(`/crm/activities/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updateData)
    });
  }

  /**
   * Get CRM statistics
   */
  async getCrmStats(filters = {}) {
    const params = new URLSearchParams();
    if (filters.userId) params.append('userId', filters.userId);
    return this.request(`/crm/stats?${params.toString()}`);
  }

  /**
   * Project Management Methods
   */

  /**
   * Get all projects
   */
  async getProjects(filters = {}) {
    const params = new URLSearchParams();
    if (filters.userId) params.append('userId', filters.userId);
    if (filters.status) params.append('status', filters.status);
    if (filters.search) params.append('search', filters.search);
    if (filters.page) params.append('page', filters.page);
    if (filters.limit) params.append('limit', filters.limit);
    return this.request(`/projects/projects?${params.toString()}`);
  }

  /**
   * Get project by ID
   */
  async getProject(id) {
    return this.request(`/projects/projects/${id}`);
  }

  /**
   * Create project
   */
  async createProject(projectData) {
    return this.request('/projects/projects', {
      method: 'POST',
      body: JSON.stringify(projectData)
    });
  }

  /**
   * Update project
   */
  async updateProject(id, updateData) {
    return this.request(`/projects/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updateData)
    });
  }

  /**
   * Delete project
   */
  async deleteProject(id) {
    return this.request(`/projects/projects/${id}`, {
      method: 'DELETE'
    });
  }

  /**
   * Get tasks for project
   */
  async getProjectTasks(projectId, filters = {}) {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.assignedTo) params.append('assignedTo', filters.assignedTo);
    return this.request(`/projects/projects/${projectId}/tasks?${params.toString()}`);
  }

  /**
   * Create task
   */
  async createProjectTask(projectId, taskData) {
    return this.request(`/projects/projects/${projectId}/tasks`, {
      method: 'POST',
      body: JSON.stringify(taskData)
    });
  }

  /**
   * Update task
   */
  async updateProjectTask(id, updateData) {
    return this.request(`/projects/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updateData)
    });
  }

  /**
   * Delete task
   */
  async deleteProjectTask(id) {
    return this.request(`/projects/tasks/${id}`, {
      method: 'DELETE'
    });
  }

  /**
   * Add team member to project
   */
  async addProjectTeamMember(projectId, userId, role = 'member') {
    return this.request(`/projects/projects/${projectId}/team`, {
      method: 'POST',
      body: JSON.stringify({ userId, role })
    });
  }

  /**
   * Remove team member from project
   */
  async removeProjectTeamMember(projectId, userId) {
    return this.request(`/projects/projects/${projectId}/team/${userId}`, {
      method: 'DELETE'
    });
  }

  /**
   * LMS Methods
   */

  /**
   * Get all courses
   */
  async getLmsCourses(filters = {}) {
    const params = new URLSearchParams();
    if (filters.instructorId) params.append('instructorId', filters.instructorId);
    if (filters.status) params.append('status', filters.status);
    if (filters.category) params.append('category', filters.category);
    if (filters.level) params.append('level', filters.level);
    if (filters.search) params.append('search', filters.search);
    if (filters.page) params.append('page', filters.page);
    if (filters.limit) params.append('limit', filters.limit);
    return this.request(`/lms/courses?${params.toString()}`);
  }

  /**
   * Get course by ID
   */
  async getLmsCourse(id) {
    return this.request(`/lms/courses/${id}`);
  }

  /**
   * Create course
   */
  async createLmsCourse(courseData) {
    return this.request('/lms/courses', {
      method: 'POST',
      body: JSON.stringify(courseData)
    });
  }

  /**
   * Update course
   */
  async updateLmsCourse(id, updateData) {
    return this.request(`/lms/courses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updateData)
    });
  }

  /**
   * Delete course
   */
  async deleteLmsCourse(id) {
    return this.request(`/lms/courses/${id}`, {
      method: 'DELETE'
    });
  }

  /**
   * Get lessons for course
   */
  async getLmsLessons(courseId) {
    return this.request(`/lms/courses/${courseId}/lessons`);
  }

  /**
   * Create lesson
   */
  async createLmsLesson(courseId, lessonData) {
    return this.request(`/lms/courses/${courseId}/lessons`, {
      method: 'POST',
      body: JSON.stringify(lessonData)
    });
  }

  /**
   * Update lesson
   */
  async updateLmsLesson(id, updateData) {
    return this.request(`/lms/lessons/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updateData)
    });
  }

  /**
   * Delete lesson
   */
  async deleteLmsLesson(id) {
    return this.request(`/lms/lessons/${id}`, {
      method: 'DELETE'
    });
  }

  /**
   * Get enrollments
   */
  async getLmsEnrollments(filters = {}) {
    const params = new URLSearchParams();
    if (filters.courseId) params.append('courseId', filters.courseId);
    if (filters.studentId) params.append('studentId', filters.studentId);
    if (filters.status) params.append('status', filters.status);
    if (filters.page) params.append('page', filters.page);
    if (filters.limit) params.append('limit', filters.limit);
    return this.request(`/lms/enrollments?${params.toString()}`);
  }

  /**
   * Enroll in course
   */
  async enrollInLmsCourse(courseId) {
    return this.request(`/lms/courses/${courseId}/enroll`, {
      method: 'POST'
    });
  }

  /**
   * Update enrollment progress
   */
  async updateLmsEnrollmentProgress(enrollmentId, progress) {
    return this.request(`/lms/enrollments/${enrollmentId}/progress`, {
      method: 'PUT',
      body: JSON.stringify({ progress })
    });
  }

  /**
   * Update lesson progress
   */
  async updateLmsLessonProgress(enrollmentId, lessonId, progressData) {
    return this.request(`/lms/enrollments/${enrollmentId}/lessons/${lessonId}/progress`, {
      method: 'PUT',
      body: JSON.stringify(progressData)
    });
  }

  /**
   * Help Desk Methods
   */

  /**
   * Get all tickets
   */
  async getHelpdeskTickets(filters = {}) {
    const params = new URLSearchParams();
    if (filters.assignedTo) params.append('assignedTo', filters.assignedTo);
    if (filters.createdBy) params.append('createdBy', filters.createdBy);
    if (filters.status) params.append('status', filters.status);
    if (filters.priority) params.append('priority', filters.priority);
    if (filters.category) params.append('category', filters.category);
    if (filters.search) params.append('search', filters.search);
    if (filters.page) params.append('page', filters.page);
    if (filters.limit) params.append('limit', filters.limit);
    return this.request(`/helpdesk/tickets?${params.toString()}`);
  }

  /**
   * Get ticket by ID
   */
  async getHelpdeskTicket(id) {
    return this.request(`/helpdesk/tickets/${id}`);
  }

  /**
   * Create ticket
   */
  async createHelpdeskTicket(ticketData) {
    return this.request('/helpdesk/tickets', {
      method: 'POST',
      body: JSON.stringify(ticketData)
    });
  }

  /**
   * Update ticket
   */
  async updateHelpdeskTicket(id, updateData) {
    return this.request(`/helpdesk/tickets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updateData)
    });
  }

  /**
   * Delete ticket
   */
  async deleteHelpdeskTicket(id) {
    return this.request(`/helpdesk/tickets/${id}`, {
      method: 'DELETE'
    });
  }

  /**
   * Add comment to ticket
   */
  async addHelpdeskComment(ticketId, commentData) {
    return this.request(`/helpdesk/tickets/${ticketId}/comments`, {
      method: 'POST',
      body: JSON.stringify(commentData)
    });
  }

  /**
   * Get agents
   */
  async getHelpdeskAgents() {
    return this.request('/helpdesk/agents');
  }

  /**
   * Add agent
   */
  async addHelpdeskAgent(agentData) {
    return this.request('/helpdesk/agents', {
      method: 'POST',
      body: JSON.stringify(agentData)
    });
  }

  /**
   * Get ticket statistics
   */
  async getHelpdeskStats(filters = {}) {
    const params = new URLSearchParams();
    if (filters.assignedTo) params.append('assignedTo', filters.assignedTo);
    if (filters.createdBy) params.append('createdBy', filters.createdBy);
    return this.request(`/helpdesk/stats?${params.toString()}`);
  }

  /**
   * HR Management Methods
   */

  /**
   * Get all employees
   */
  async getHrEmployees(filters = {}) {
    const params = new URLSearchParams();
    if (filters.department) params.append('department', filters.department);
    if (filters.status) params.append('status', filters.status);
    if (filters.employmentType) params.append('employmentType', filters.employmentType);
    if (filters.search) params.append('search', filters.search);
    if (filters.page) params.append('page', filters.page);
    if (filters.limit) params.append('limit', filters.limit);
    return this.request(`/hr/employees?${params.toString()}`);
  }

  /**
   * Get employee by ID
   */
  async getHrEmployee(id) {
    return this.request(`/hr/employees/${id}`);
  }

  /**
   * Create employee
   */
  async createHrEmployee(employeeData) {
    return this.request('/hr/employees', {
      method: 'POST',
      body: JSON.stringify(employeeData)
    });
  }

  /**
   * Update employee
   */
  async updateHrEmployee(id, updateData) {
    return this.request(`/hr/employees/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updateData)
    });
  }

  /**
   * Get attendance records
   */
  async getHrAttendance(filters = {}) {
    const params = new URLSearchParams();
    if (filters.employeeId) params.append('employeeId', filters.employeeId);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.status) params.append('status', filters.status);
    if (filters.page) params.append('page', filters.page);
    if (filters.limit) params.append('limit', filters.limit);
    return this.request(`/hr/attendance?${params.toString()}`);
  }

  /**
   * Record attendance
   */
  async recordHrAttendance(employeeId, attendanceData) {
    return this.request('/hr/attendance', {
      method: 'POST',
      body: JSON.stringify({ employeeId, ...attendanceData })
    });
  }

  /**
   * Get leave requests
   */
  async getHrLeaveRequests(filters = {}) {
    const params = new URLSearchParams();
    if (filters.employeeId) params.append('employeeId', filters.employeeId);
    if (filters.status) params.append('status', filters.status);
    if (filters.leaveType) params.append('leaveType', filters.leaveType);
    if (filters.page) params.append('page', filters.page);
    if (filters.limit) params.append('limit', filters.limit);
    return this.request(`/hr/leave-requests?${params.toString()}`);
  }

  /**
   * Create leave request
   */
  async createHrLeaveRequest(employeeId, requestData) {
    return this.request('/hr/leave-requests', {
      method: 'POST',
      body: JSON.stringify({ employeeId, ...requestData })
    });
  }

  /**
   * Update leave request status
   */
  async updateHrLeaveRequestStatus(requestId, status, approvedBy, rejectionReason) {
    return this.request(`/hr/leave-requests/${requestId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, approvedBy, rejectionReason })
    });
  }

  /**
   * Get payroll records
   */
  async getHrPayroll(filters = {}) {
    const params = new URLSearchParams();
    if (filters.employeeId) params.append('employeeId', filters.employeeId);
    if (filters.status) params.append('status', filters.status);
    if (filters.page) params.append('page', filters.page);
    if (filters.limit) params.append('limit', filters.limit);
    return this.request(`/hr/payroll?${params.toString()}`);
  }

  /**
   * Create payroll record
   */
  async createHrPayroll(employeeId, payrollData) {
    return this.request('/hr/payroll', {
      method: 'POST',
      body: JSON.stringify({ employeeId, ...payrollData })
    });
  }

  /**
   * Get departments
   */
  async getHrDepartments() {
    return this.request('/hr/departments');
  }

  /**
   * Create department
   */
  async createHrDepartment(departmentData) {
    return this.request('/hr/departments', {
      method: 'POST',
      body: JSON.stringify(departmentData)
    });
  }

  /**
   * Events Methods
   */

  /**
   * Get all events
   */
  async getEvents(filters = {}) {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.eventType) params.append('eventType', filters.eventType);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.search) params.append('search', filters.search);
    if (filters.page) params.append('page', filters.page);
    if (filters.limit) params.append('limit', filters.limit);
    return this.request(`/events/events?${params.toString()}`);
  }

  /**
   * Get event by ID
   */
  async getEvent(id) {
    return this.request(`/events/events/${id}`);
  }

  /**
   * Create event
   */
  async createEvent(eventData) {
    return this.request('/events/events', {
      method: 'POST',
      body: JSON.stringify(eventData)
    });
  }

  /**
   * Update event
   */
  async updateEvent(id, updateData) {
    return this.request(`/events/events/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updateData)
    });
  }

  /**
   * Delete event
   */
  async deleteEvent(id) {
    return this.request(`/events/events/${id}`, {
      method: 'DELETE'
    });
  }

  /**
   * Register for event
   */
  async registerForEvent(eventId, registrationData) {
    return this.request(`/events/events/${eventId}/register`, {
      method: 'POST',
      body: JSON.stringify(registrationData)
    });
  }

  /**
   * Get event registrations
   */
  async getEventRegistrations(eventId, filters = {}) {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.paymentStatus) params.append('paymentStatus', filters.paymentStatus);
    if (filters.page) params.append('page', filters.page);
    if (filters.limit) params.append('limit', filters.limit);
    return this.request(`/events/events/${eventId}/registrations?${params.toString()}`);
  }

  /**
   * Add speaker to event
   */
  async addEventSpeaker(eventId, speakerData) {
    return this.request(`/events/events/${eventId}/speakers`, {
      method: 'POST',
      body: JSON.stringify(speakerData)
    });
  }

  /**
   * Add session to event
   */
  async addEventSession(eventId, sessionData) {
    return this.request(`/events/events/${eventId}/sessions`, {
      method: 'POST',
      body: JSON.stringify(sessionData)
    });
  }

  /**
   * Social Methods
   */

  /**
   * Get all posts (feed)
   */
  async getSocialPosts(filters = {}) {
    const params = new URLSearchParams();
    if (filters.userId) params.append('userId', filters.userId);
    if (filters.following) params.append('following', filters.following);
    if (filters.postType) params.append('postType', filters.postType);
    if (filters.search) params.append('search', filters.search);
    if (filters.page) params.append('page', filters.page);
    if (filters.limit) params.append('limit', filters.limit);
    return this.request(`/social/posts?${params.toString()}`);
  }

  /**
   * Get post by ID
   */
  async getSocialPost(id) {
    return this.request(`/social/posts/${id}`);
  }

  /**
   * Create post
   */
  async createSocialPost(postData) {
    return this.request('/social/posts', {
      method: 'POST',
      body: JSON.stringify(postData)
    });
  }

  /**
   * Update post
   */
  async updateSocialPost(id, updateData) {
    return this.request(`/social/posts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updateData)
    });
  }

  /**
   * Delete post
   */
  async deleteSocialPost(id) {
    return this.request(`/social/posts/${id}`, {
      method: 'DELETE'
    });
  }

  /**
   * Like/Unlike post
   */
  async toggleSocialPostLike(id) {
    return this.request(`/social/posts/${id}/like`, {
      method: 'POST'
    });
  }

  /**
   * Add comment to post
   */
  async addSocialPostComment(postId, commentData) {
    return this.request(`/social/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify(commentData)
    });
  }

  /**
   * Follow/Unfollow user
   */
  async toggleSocialFollow(userId) {
    return this.request(`/social/users/${userId}/follow`, {
      method: 'POST'
    });
  }

  /**
   * Get notifications
   */
  async getSocialNotifications(filters = {}) {
    const params = new URLSearchParams();
    if (filters.isRead !== undefined) params.append('isRead', filters.isRead);
    if (filters.page) params.append('page', filters.page);
    if (filters.limit) params.append('limit', filters.limit);
    return this.request(`/social/notifications?${params.toString()}`);
  }

  /**
   * Mark notification as read
   */
  async markSocialNotificationAsRead(notificationId) {
    return this.request(`/social/notifications/${notificationId}/read`, {
      method: 'PUT'
    });
  }

  /**
   * Users & Profile Methods
   */

  /**
   * Get all users (admin only)
   */
  async getUsers(filters = {}) {
    const params = new URLSearchParams();
    if (filters.role) params.append('role', filters.role);
    if (filters.status) params.append('status', filters.status);
    if (filters.search) params.append('search', filters.search);
    if (filters.page) params.append('page', filters.page);
    if (filters.limit) params.append('limit', filters.limit);
    return this.request(`/users/users?${params.toString()}`);
  }

  /**
   * Get user by ID
   */
  async getUser(id) {
    return this.request(`/users/users/${id}`);
  }

  /**
   * Update user (admin only)
   */
  async updateUser(id, updateData) {
    return this.request(`/users/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updateData)
    });
  }

  /**
   * Get current user profile
   */
  async getProfile() {
    return this.request('/users/profile');
  }

  /**
   * Update current user profile
   */
  async updateProfile(profileData) {
    return this.request('/users/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData)
    });
  }

  /**
   * Get user profile by ID
   */
  async getUserProfile(userId) {
    return this.request(`/users/profile/${userId}`);
  }

  /**
   * Change password
   */
  async changePassword(currentPassword, newPassword) {
    return this.request('/users/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword })
    });
  }

  /**
   * Get activity logs
   */
  async getActivityLogs(filters = {}) {
    const params = new URLSearchParams();
    if (filters.activityType) params.append('activityType', filters.activityType);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.page) params.append('page', filters.page);
    if (filters.limit) params.append('limit', filters.limit);
    return this.request(`/users/activity-logs?${params.toString()}`);
  }

  /**
   * Log activity
   */
  async logActivity(activityData) {
    return this.request('/users/activity-logs', {
      method: 'POST',
      body: JSON.stringify(activityData)
    });
  }

  /**
   * School Methods
   */

  /**
   * Get all students
   */
  async getSchoolStudents(filters = {}) {
    const params = new URLSearchParams();
    if (filters.grade) params.append('grade', filters.grade);
    if (filters.class) params.append('class', filters.class);
    if (filters.status) params.append('status', filters.status);
    if (filters.search) params.append('search', filters.search);
    if (filters.page) params.append('page', filters.page);
    if (filters.limit) params.append('limit', filters.limit);
    return this.request(`/school/students?${params.toString()}`);
  }

  /**
   * Get student by ID
   */
  async getSchoolStudent(id) {
    return this.request(`/school/students/${id}`);
  }

  /**
   * Create student
   */
  async createSchoolStudent(studentData) {
    return this.request('/school/students', {
      method: 'POST',
      body: JSON.stringify(studentData)
    });
  }

  /**
   * Get all courses
   */
  async getSchoolCourses(filters = {}) {
    const params = new URLSearchParams();
    if (filters.teacherId) params.append('teacherId', filters.teacherId);
    if (filters.gradeLevel) params.append('gradeLevel', filters.gradeLevel);
    if (filters.status) params.append('status', filters.status);
    if (filters.page) params.append('page', filters.page);
    if (filters.limit) params.append('limit', filters.limit);
    return this.request(`/school/courses?${params.toString()}`);
  }

  /**
   * Create course
   */
  async createSchoolCourse(courseData) {
    return this.request('/school/courses', {
      method: 'POST',
      body: JSON.stringify(courseData)
    });
  }

  /**
   * Enroll student in course
   */
  async enrollSchoolStudent(studentId, courseId) {
    return this.request('/school/enrollments', {
      method: 'POST',
      body: JSON.stringify({ studentId, courseId })
    });
  }

  /**
   * Record attendance
   */
  async recordSchoolAttendance(attendanceData) {
    return this.request('/school/attendance', {
      method: 'POST',
      body: JSON.stringify(attendanceData)
    });
  }

  /**
   * Add grade
   */
  async addSchoolGrade(enrollmentId, gradeData) {
    return this.request('/school/grades', {
      method: 'POST',
      body: JSON.stringify({ enrollmentId, ...gradeData })
    });
  }

  /**
   * Get student grades
   */
  async getSchoolStudentGrades(enrollmentId) {
    return this.request(`/school/enrollments/${enrollmentId}/grades`);
  }

  /**
   * Hospital Methods
   */

  /**
   * Get all patients
   */
  async getHospitalPatients(filters = {}) {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.search) params.append('search', filters.search);
    if (filters.page) params.append('page', filters.page);
    if (filters.limit) params.append('limit', filters.limit);
    return this.request(`/hospital/patients?${params.toString()}`);
  }

  /**
   * Get patient by ID
   */
  async getHospitalPatient(id) {
    return this.request(`/hospital/patients/${id}`);
  }

  /**
   * Create patient
   */
  async createHospitalPatient(patientData) {
    return this.request('/hospital/patients', {
      method: 'POST',
      body: JSON.stringify(patientData)
    });
  }

  /**
   * Get appointments
   */
  async getHospitalAppointments(filters = {}) {
    const params = new URLSearchParams();
    if (filters.patientId) params.append('patientId', filters.patientId);
    if (filters.doctorId) params.append('doctorId', filters.doctorId);
    if (filters.status) params.append('status', filters.status);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.page) params.append('page', filters.page);
    if (filters.limit) params.append('limit', filters.limit);
    return this.request(`/hospital/appointments?${params.toString()}`);
  }

  /**
   * Create appointment
   */
  async createHospitalAppointment(appointmentData) {
    return this.request('/hospital/appointments', {
      method: 'POST',
      body: JSON.stringify(appointmentData)
    });
  }

  /**
   * Create admission
   */
  async createHospitalAdmission(admissionData) {
    return this.request('/hospital/admissions', {
      method: 'POST',
      body: JSON.stringify(admissionData)
    });
  }

  /**
   * Discharge patient
   */
  async dischargeHospitalPatient(admissionId, dischargeDate) {
    return this.request(`/hospital/admissions/${admissionId}/discharge`, {
      method: 'PUT',
      body: JSON.stringify({ dischargeDate })
    });
  }

  /**
   * Prescribe medication
   */
  async prescribeHospitalMedication(medicationData) {
    return this.request('/hospital/medications', {
      method: 'POST',
      body: JSON.stringify(medicationData)
    });
  }

  /**
   * Create bill
   */
  async createHospitalBill(billData) {
    return this.request('/hospital/billing', {
      method: 'POST',
      body: JSON.stringify(billData)
    });
  }

  /**
   * Update payment
   */
  async updateHospitalPayment(billId, paymentData) {
    return this.request(`/hospital/billing/${billId}/payment`, {
      method: 'PUT',
      body: JSON.stringify(paymentData)
    });
  }

  /**
   * Invoices Methods (Enhanced)
   */

  /**
   * Get invoice by ID
   */
  async getInvoice(id) {
    return this.request(`/invoices/${id}`);
  }

  /**
   * Delete invoice
   */
  async deleteInvoice(id) {
    return this.request(`/invoices/${id}`, {
      method: 'DELETE'
    });
  }

  /**
   * Get invoice statistics
   */
  async getInvoiceStats(filters = {}) {
    const params = new URLSearchParams();
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    return this.request(`/invoices/stats?${params.toString()}`);
  }
}

// Export singleton instance
const apiService = new ApiService();
apiService.API_BASE_URL = API_BASE_URL;
window.apiService = apiService; // Make available globally
