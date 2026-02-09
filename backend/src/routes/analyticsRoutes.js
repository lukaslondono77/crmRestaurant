const express = require('express');
const analyticsService = require('../services/analyticsService');
const { authenticate, tenantFilter } = require('../middleware/auth');
const { asyncHandler, ApiError, ErrorCodes, validateDateRange, formatSuccessResponse } = require('../utils/errorHandler');

const router = express.Router();

// GET /api/analytics/food-cost - Calculate food cost
router.get('/food-cost', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const { startDate, endDate } = req.query;
  
  validateDateRange(startDate, endDate);

  const foodCost = await analyticsService.calculateFoodCost(tenantId, startDate, endDate);
  const response = formatSuccessResponse(foodCost);
  res.json(response);
}));

// GET /api/analytics/waste-analysis - Get detailed waste analysis
router.get('/waste-analysis', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const { startDate, endDate } = req.query;
  const defaultEndDate = new Date().toISOString().split('T')[0];
  const defaultStartDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const wasteAnalysis = await analyticsService.calculateWaste(
    tenantId,
    startDate || defaultStartDate,
    endDate || defaultEndDate
  );

  const response = formatSuccessResponse(wasteAnalysis);
  res.json(response);
}));

// GET /api/analytics/slow-moving - Get slow-moving items
router.get('/slow-moving', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const threshold = parseInt(req.query.days) || 7;
  const items = await analyticsService.getSlowMovingItems(tenantId, threshold);
  const response = formatSuccessResponse(items);
  res.json(response);
}));

// GET /api/analytics/product-margins - Calculate profit margins by product
router.get('/product-margins', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const { startDate, endDate } = req.query;
  const defaultEndDate = new Date().toISOString().split('T')[0];
  const defaultStartDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const margins = await analyticsService.calculateProductMargins(
    tenantId,
    startDate || defaultStartDate,
    endDate || defaultEndDate
  );

  const response = formatSuccessResponse(margins);
  res.json(response);
}));

// GET /api/analytics/trends - Get trends analysis
router.get('/trends', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const periodType = req.query.periodType || 'weekly'; // 'weekly' or 'monthly'
  const periods = parseInt(req.query.periods) || 4;

  const trends = await analyticsService.getTrendsAnalysis(tenantId, periodType, periods);
  const response = formatSuccessResponse(trends);
  res.json(response);
}));

// GET /api/analytics/suppliers - Get supplier ranking
router.get('/suppliers', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const { startDate, endDate } = req.query;
  const defaultEndDate = new Date().toISOString().split('T')[0];
  const defaultStartDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const ranking = await analyticsService.getSupplierRanking(
    tenantId,
    startDate || defaultStartDate,
    endDate || defaultEndDate
  );

  const response = formatSuccessResponse(ranking);
  res.json(response);
}));

// GET /api/analytics/compare - Compare performance between periods
router.get('/compare', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const { period1Start, period1End, period2Start, period2End } = req.query;

  if (!period1Start || !period1End || !period2Start || !period2End) {
    throw new ApiError(
      ErrorCodes.MISSING_REQUIRED_FIELD,
      'All period parameters required: period1Start, period1End, period2Start, period2End',
      { missingFields: ['period1Start', 'period1End', 'period2Start', 'period2End'] },
      400
    );
  }

  const comparison = await analyticsService.comparePeriods(
    tenantId,
    period1Start,
    period1End,
    period2Start,
    period2End
  );

  const response = formatSuccessResponse(comparison);
  res.json(response);
}));

// GET /api/analytics/alerts - Get expiring items alerts
router.get('/alerts', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const daysAhead = parseInt(req.query.daysAhead) || 7;
  const alerts = await analyticsService.getExpiringItemsAlerts(tenantId, daysAhead);
  const response = formatSuccessResponse({ alerts, count: alerts.length });
  res.json(response);
}));

module.exports = router;
