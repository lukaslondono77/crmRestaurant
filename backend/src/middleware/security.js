/**
 * Advanced Security Middleware
 * Implements additional security layers
 */

const rateLimit = require('express-rate-limit');

// Rate limiting configurations
const createRateLimiter = (windowMs, max, message) => {
  return rateLimit({
    windowMs: windowMs,
    max: max,
    message: {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: message || 'Too many requests, please try again later.'
      }
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      // Skip rate limiting for health checks
      return req.path === '/api/healthz' || req.path === '/api/performance/health';
    }
  });
};

// Different rate limits for different endpoints
// In development, use more lenient limits
const isDevelopment = process.env.NODE_ENV !== 'production';

const rateLimiters = {
  // Strict rate limit for auth endpoints
  // More lenient in development (20 attempts per 15 min vs 5 in production)
  auth: createRateLimiter(
    15 * 60 * 1000, 
    isDevelopment ? 20 : 5, 
    'Too many login attempts. Please try again in 15 minutes.'
  ),
  
  // Moderate rate limit for API endpoints
  api: createRateLimiter(15 * 60 * 1000, 100, 'API rate limit exceeded. Please slow down.'),
  
  // Lenient rate limit for read operations
  read: createRateLimiter(15 * 60 * 1000, 200, 'Too many read requests. Please slow down.'),
  
  // Very strict for file uploads
  upload: createRateLimiter(60 * 60 * 1000, 10, 'Too many file uploads. Please try again in an hour.')
};

/**
 * Security headers middleware
 */
function securityHeaders(req, res, next) {
  // X-Content-Type-Options
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // X-Frame-Options
  res.setHeader('X-Frame-Options', 'DENY');
  
  // X-XSS-Protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Strict-Transport-Security (HTTPS only)
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  // Content-Security-Policy
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "img-src 'self' data: https:; " +
    "font-src 'self' data: https://fonts.gstatic.com; " +
    "connect-src 'self'"
  );
  
  // Referrer-Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions-Policy
  res.setHeader('Permissions-Policy', 
    'geolocation=(), microphone=(), camera=()'
  );
  
  next();
}

/**
 * Input sanitization middleware
 */
function sanitizeInput(req, res, next) {
  // Remove any keys that start with $ or contain .
  if (req.body && typeof req.body === 'object') {
    sanitizeObject(req.body);
  }
  
  if (req.query && typeof req.query === 'object') {
    sanitizeObject(req.query);
  }
  
  next();
}

function sanitizeObject(obj) {
  for (const key in obj) {
    if (key.startsWith('$') || key.includes('.')) {
      delete obj[key];
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      sanitizeObject(obj[key]);
    }
  }
}

/**
 * SQL injection prevention helper
 */
function validateSQLInput(input) {
  if (typeof input !== 'string') {
    return true;
  }
  
  // Check for SQL injection patterns
  const dangerousPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/i,
    /(--|#|\/\*|\*\/)/,
    /(\b(UNION|OR|AND)\b.*\b(SELECT|INSERT|UPDATE|DELETE)\b)/i,
    /('|"|;|\\|`)/g
  ];
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(input)) {
      return false;
    }
  }
  
  return true;
}

/**
 * Request size validation
 */
function validateRequestSize(req, res, next) {
  const contentLength = parseInt(req.headers['content-length'] || '0');
  const maxSize = 10 * 1024 * 1024; // 10MB
  
  if (contentLength > maxSize) {
    return res.status(413).json({
      success: false,
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Request payload too large. Maximum size is 10MB.'
      }
    });
  }
  
  next();
}

/**
 * Audit logging for sensitive operations
 */
function auditLog(req, res, next) {
  const sensitivePaths = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/users',
    '/api/performance/feature-flags',
    '/api/performance/clear-cache'
  ];
  
  const isSensitive = sensitivePaths.some(path => req.path.startsWith(path));
  
  if (isSensitive) {
    const auditEntry = {
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
      userId: req.user?.id || 'anonymous'
    };
    
    // Log to console (in production, use proper logging service)
    console.log('[AUDIT]', JSON.stringify(auditEntry));
  }
  
  next();
}

module.exports = {
  rateLimiters,
  securityHeaders,
  sanitizeInput,
  validateSQLInput,
  validateRequestSize,
  auditLog
};
