const express = require('express');
const { rateLimiters } = require('../middleware/security');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { asyncHandler, ApiError, ErrorCodes, formatSuccessResponse } = require('../utils/errorHandler');

const router = express.Router();

/**
 * POST /api/auth/register
 * Registra una nueva empresa y usuario administrador
 */
router.post('/register', rateLimiters.auth, [
  body('companyName').trim().notEmpty().withMessage('Company name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('firstName').trim().notEmpty().withMessage('First name is required'),
  body('lastName').trim().notEmpty().withMessage('Last name is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(ErrorCodes.VALIDATION_ERROR, 'Validation failed', errors.array(), 400);
  }

  const { companyName, email, password, firstName, lastName } = req.body;

  // Verificar si el email ya existe
  const existingUser = await db.getAsync('SELECT id FROM users WHERE email = ?', [email]);
  if (existingUser) {
    throw new ApiError(ErrorCodes.VALIDATION_ERROR, 'Email already registered', null, 400);
  }

  // Crear tenant (empresa)
  const tenantResult = await db.runAsync(`
    INSERT INTO tenants (company_name, subscription_status, trial_ends_at)
    VALUES (?, 'trial', date('now', '+14 days'))
  `, [companyName]);

  const tenantId = tenantResult.lastID;

  // Hash password
  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  // Crear usuario administrador
  const userResult = await db.runAsync(`
    INSERT INTO users (tenant_id, email, password_hash, first_name, last_name, role)
    VALUES (?, ?, ?, ?, ?, 'admin')
  `, [tenantId, email, passwordHash, firstName, lastName]);

  // Generar token (JWT_SECRET required; validated at startup in config/env.js)
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is required');
  const token = jwt.sign(
    { userId: userResult.lastID, tenantId, email, role: 'admin' },
    secret,
    { expiresIn: '7d' }
  );

  // Calcular fecha de fin de trial
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 14);

  res.json(formatSuccessResponse({
    token,
    user: {
      id: userResult.lastID,
      email,
      firstName,
      lastName,
      role: 'admin',
      tenantId
    },
    tenant: {
      id: tenantId,
      companyName,
      subscriptionStatus: 'trial',
      trialEndsAt: trialEndsAt.toISOString().split('T')[0]
    }
  }));
}));

/**
 * POST /api/auth/login
 * Login de usuario existente
 */
router.post('/login', rateLimiters.auth, [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(ErrorCodes.VALIDATION_ERROR, 'Validation failed', errors.array(), 400);
  }

  const { email, password } = req.body;

  // Buscar usuario con información del tenant
  const user = await db.getAsync(`
    SELECT u.*, t.company_name, t.subscription_status, t.subscription_plan, t.trial_ends_at
    FROM users u
    JOIN tenants t ON u.tenant_id = t.id
    WHERE u.email = ? AND u.is_active = 1
  `, [email]);

  if (!user) {
    throw new ApiError(ErrorCodes.UNAUTHORIZED, 'Invalid email or password', null, 401);
  }

  // Verificar password
  const passwordMatch = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatch) {
    throw new ApiError(ErrorCodes.UNAUTHORIZED, 'Invalid email or password', null, 401);
  }

  // Verificar que el tenant esté activo
  if (user.subscription_status !== 'active' && user.subscription_status !== 'trial') {
    throw new ApiError(ErrorCodes.FORBIDDEN, 'Your subscription is not active', null, 403);
  }

  // Verificar si el trial expiró
  if (user.subscription_status === 'trial' && user.trial_ends_at) {
    const trialEnd = new Date(user.trial_ends_at);
    if (trialEnd < new Date()) {
      throw new ApiError(ErrorCodes.FORBIDDEN, 'Trial period has expired. Please subscribe.', null, 403);
    }
  }

  // Actualizar último login
  await db.runAsync('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

  // Generar token (JWT_SECRET required; validated at startup in config/env.js)
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is required');
  const token = jwt.sign(
    { 
      userId: user.id, 
      tenantId: user.tenant_id, 
      email: user.email, 
      role: user.role 
    },
    secret,
    { expiresIn: '7d' }
  );

  res.json(formatSuccessResponse({
    token,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      tenantId: user.tenant_id
    },
    tenant: {
      id: user.tenant_id,
      companyName: user.company_name,
      subscriptionStatus: user.subscription_status,
      subscriptionPlan: user.subscription_plan
    }
  }));
}));

/**
 * GET /api/auth/me
 * Obtener información del usuario actual
 */
router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const user = await db.getAsync(`
    SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.tenant_id,
           t.company_name, t.subscription_status, t.subscription_plan
    FROM users u
    JOIN tenants t ON u.tenant_id = t.id
    WHERE u.id = ?
  `, [req.user.id]);

  if (!user) {
    throw new ApiError(ErrorCodes.NOT_FOUND, 'User not found', null, 404);
  }

  res.json(formatSuccessResponse({
    user: {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      tenantId: user.tenant_id
    },
    tenant: {
      id: user.tenant_id,
      companyName: user.company_name,
      subscriptionStatus: user.subscription_status,
      subscriptionPlan: user.subscription_plan
    }
  }));
}));

module.exports = router;
