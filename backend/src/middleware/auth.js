const jwt = require('jsonwebtoken');
const db = require('../config/database');

// JWT_SECRET is validated in env.js
const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Middleware para verificar JWT token
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'No token provided. Please login first.'
        }
      });
    }

    const token = authHeader.split(' ')[1];
    
    // Verificar token (JWT_SECRET is validated on server startup)
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Verificar que el usuario existe y está activo
    const user = await db.getAsync(
      `SELECT u.*, t.subscription_status, t.subscription_plan 
       FROM users u 
       JOIN tenants t ON u.tenant_id = t.id 
       WHERE u.id = ? AND u.is_active = 1`,
      [decoded.userId]
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found or inactive'
        }
      });
    }

    // Verificar que el tenant está activo
    if (user.subscription_status !== 'active' && user.subscription_status !== 'trial') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'SUBSCRIPTION_INACTIVE',
          message: 'Your subscription is not active. Please renew your subscription.'
        }
      });
    }

    // Agregar información del usuario a la request
    req.user = {
      id: user.id,
      tenantId: user.tenant_id,
      email: user.email,
      role: user.role,
      subscriptionPlan: user.subscription_plan
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Token has expired. Please login again.'
        }
      });
    }
    
    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid token'
      }
    });
  }
};

/**
 * Middleware para verificar roles
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to access this resource'
        }
      });
    }

    next();
  };
};

/**
 * Middleware para filtrar queries por tenant
 * Asegura que cada query solo acceda a datos del tenant del usuario
 */
const tenantFilter = (req, res, next) => {
  if (!req.user || !req.user.tenantId) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'User context required'
      }
    });
  }

  req.tenantId = req.user.tenantId;
  return next();
};

module.exports = {
  authenticate,
  authorize,
  tenantFilter
};
