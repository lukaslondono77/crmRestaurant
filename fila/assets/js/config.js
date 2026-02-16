/**
 * Frontend Configuration
 * This file can be customized per environment
 */

(function() {
  'use strict';
  
  // Auto-detect environment
  const hostname = window.location.hostname;
  const isProduction = hostname !== 'localhost' && hostname !== '127.0.0.1';
  
  // Configuration object
  window.APP_CONFIG = {
    // API Configuration
    API_BASE_URL: (function() {
      // Check if explicitly set in HTML
      if (window.API_BASE_URL) {
        return window.API_BASE_URL;
      }
      
      // Production: use same origin
      if (isProduction) {
        const protocol = window.location.protocol;
        const host = window.location.host;
        return `${protocol}//${host}/api`;
      }
      
      // Development: default to localhost:8000
      return 'http://localhost:8000/api';
    })(),
    
    // Environment
    ENV: isProduction ? 'production' : 'development',
    
    // Feature flags
    FEATURES: {
      DEBUG_MODE: !isProduction,
      ENABLE_LOGGING: !isProduction,
      ENABLE_ANALYTICS: isProduction
    },
    
    // Timeouts
    REQUEST_TIMEOUT: 30000, // 30 seconds
    UPLOAD_TIMEOUT: 300000, // 5 minutes
    
    // Pagination defaults
    DEFAULT_PAGE_SIZE: 50,
    MAX_PAGE_SIZE: 100
  };
  
  // Log configuration in development
  if (!isProduction) {
    console.log('📋 App Configuration:', { API_BASE_URL: window.APP_CONFIG.API_BASE_URL, ENV: window.APP_CONFIG.ENV });
  }
})();
