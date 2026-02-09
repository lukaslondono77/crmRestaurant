/**
 * Authentication Service
 * Manages user authentication, tokens, and session
 */

class AuthService {
  constructor() {
    this.tokenKey = 'restaurant_cost_control_token';
    this.userKey = 'restaurant_cost_control_user';
    this.tenantKey = 'restaurant_cost_control_tenant';
  }

  /**
   * Get stored token
   */
  getToken() {
    return localStorage.getItem(this.tokenKey);
  }

  /**
   * Get current user
   */
  getCurrentUser() {
    const userStr = localStorage.getItem(this.userKey);
    return userStr ? JSON.parse(userStr) : null;
  }

  /**
   * Get current tenant
   */
  getCurrentTenant() {
    const tenantStr = localStorage.getItem(this.tenantKey);
    return tenantStr ? JSON.parse(tenantStr) : null;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    const token = this.getToken();
    if (!token) return false;

    // Check if token is expired
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const exp = payload.exp * 1000; // Convert to milliseconds
      return Date.now() < exp;
    } catch (error) {
      return false;
    }
  }

  /**
   * Store authentication data
   */
  setAuthData(token, user, tenant) {
    localStorage.setItem(this.tokenKey, token);
    localStorage.setItem(this.userKey, JSON.stringify(user));
    localStorage.setItem(this.tenantKey, JSON.stringify(tenant));
  }

  /**
   * Clear authentication data
   */
  clearAuthData() {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
    localStorage.removeItem(this.tenantKey);
  }

  /**
   * Login user
   */
  async login(email, password) {
    try {
      const response = await fetch('http://localhost:8000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || data.message || 'Login failed');
      }

      if (data.success && data.data) {
        const { token, user, tenant } = data.data;
        this.setAuthData(token, user, tenant);
        return { success: true, user, tenant };
      }

      throw new Error('Invalid response format');
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  /**
   * Register new company and user
   */
  async register(companyName, email, password, firstName, lastName) {
    try {
      const response = await fetch('http://localhost:8000/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          companyName,
          email,
          password,
          firstName,
          lastName
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || data.message || 'Registration failed');
      }

      if (data.success && data.data) {
        const { token, user, tenant } = data.data;
        this.setAuthData(token, user, tenant);
        return { success: true, user, tenant };
      }

      throw new Error('Invalid response format');
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }

  /**
   * Logout user
   */
  logout() {
    this.clearAuthData();
    window.location.href = 'sign-in.html';
  }

  /**
   * Get current user info from API
   */
  async getCurrentUserInfo() {
    const token = this.getToken();
    if (!token) {
      throw new Error('No token available');
    }

    try {
      const response = await fetch('http://localhost:8000/api/auth/me', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          // Token expired or invalid
          this.clearAuthData();
          window.location.href = 'sign-in.html';
          return null;
        }
        throw new Error(data.error?.message || data.message || 'Failed to get user info');
      }

      if (data.success && data.data) {
        const { user, tenant } = data.data;
        this.setAuthData(token, user, tenant); // Update stored data
        return { user, tenant };
      }

      return null;
    } catch (error) {
      console.error('Get user info error:', error);
      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        this.clearAuthData();
        window.location.href = 'sign-in.html';
      }
      throw error;
    }
  }

  /**
   * Require authentication - redirect to login if not authenticated
   */
  requireAuth() {
    if (!this.isAuthenticated()) {
      window.location.href = 'sign-in.html';
      return false;
    }
    return true;
  }
}

// Create global instance
const authService = new AuthService();
window.authService = authService;
