const express = require('express');
const userService = require('../services/userService');
const { authenticate, tenantFilter } = require('../middleware/auth');
const { asyncHandler, formatSuccessResponse } = require('../utils/errorHandler');

const router = express.Router();

// Profile routes (must come before /users/:id to avoid route conflicts)
router.get('/profile', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const userId = req.user.id;
  const profile = await userService.getUserProfile(tenantId, userId);
  res.json(formatSuccessResponse(profile));
}));

router.put('/profile', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const userId = req.user.id;
  const profile = await userService.updateUserProfile(tenantId, userId, req.body);
  res.json(formatSuccessResponse(profile));
}));

router.get('/profile/:userId', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const userId = parseInt(req.params.userId);
  const profile = await userService.getUserProfile(tenantId, userId);
  res.json(formatSuccessResponse(profile));
}));

// Password routes (must come before /users/:id)
router.post('/change-password', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const userId = req.user.id;
  const { currentPassword, newPassword } = req.body;
  const result = await userService.changePassword(tenantId, userId, currentPassword, newPassword);
  res.json(formatSuccessResponse(result));
}));

// Activity logs routes (must come before /users/:id)
router.get('/activity-logs', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const userId = req.user.id;
  const filters = {
    activityType: req.query.activityType,
    startDate: req.query.startDate,
    endDate: req.query.endDate,
    page: req.query.page,
    limit: req.query.limit
  };
  const result = await userService.getActivityLogs(tenantId, userId, filters);
  res.json(formatSuccessResponse(result));
}));

router.post('/activity-logs', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const userId = req.user.id;
  const activityData = {
    ...req.body,
    ipAddress: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent')
  };
  const result = await userService.logActivity(tenantId, userId, activityData);
  res.json(formatSuccessResponse(result));
}));

// Users routes (admin only) - must come after specific routes
router.get('/users', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const filters = {
    role: req.query.role,
    status: req.query.status,
    search: req.query.search,
    page: req.query.page,
    limit: req.query.limit
  };
  const result = await userService.getUsers(tenantId, filters);
  res.json(formatSuccessResponse(result));
}));

router.get('/users/:id', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const userId = parseInt(req.params.id);
  const user = await userService.getUserById(tenantId, userId);
  res.json(formatSuccessResponse(user));
}));

router.put('/users/:id', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const userId = parseInt(req.params.id);
  const user = await userService.updateUser(tenantId, userId, req.body);
  res.json(formatSuccessResponse(user));
}));


module.exports = router;
