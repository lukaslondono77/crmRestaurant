const express = require('express');
const analyticsService = require('../services/analyticsService');
const monthlyReportService = require('../services/monthlyReportService');
const executiveSummaryService = require('../services/executiveSummaryService');
const featureFlags = require('../utils/featureFlags');
const { authenticate, tenantFilter } = require('../middleware/auth');
const { asyncHandler, formatSuccessResponse } = require('../utils/errorHandler');

const router = express.Router();

// GET /api/dashboard/executive-summary - Owner View: crisis banner, Priority 1 Today, 4-card summary
router.get('/executive-summary', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  if (!featureFlags.isEnabled('ENABLE_OWNER_VIEW')) {
    return res.status(503).json({
      success: false,
      message: 'Owner View is currently disabled.',
      code: 'FEATURE_DISABLED'
    });
  }
  const tenantId = req.tenantId;
  const summary = await executiveSummaryService.getExecutiveSummary(tenantId);
  res.json(formatSuccessResponse(summary));
}));

// GET /api/dashboard/metrics - Get dashboard metrics (period-aligned: weekly | monthly | quarterly)
router.get('/metrics', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const periodType = (req.query.period || 'weekly').toLowerCase();
  const requiredDefaults = {
    lossSummary: { theoreticalCost: 0, actualCost: 0, lossAmount: 0, lossPercent: 0 },
    savingsBreakdown: { totalPotentialSavings: 0, isLoss: false, calculation: {}, items: [], summary: {} },
    foodCostDisplay: { value: 0, confidence: 'none', message: '—', tooltip: '' },
    wasteDisplay: { value: 0, confidence: 'none', message: '—', tooltip: '' }
  };
  let metrics;
  try {
    metrics = await analyticsService.getDashboardMetrics(tenantId, periodType);
  } catch (err) {
    console.error('Dashboard metrics error:', err);
    res.json(formatSuccessResponse(requiredDefaults));
    return;
  }
  if (!metrics || typeof metrics !== 'object') {
    res.json(formatSuccessResponse(requiredDefaults));
    return;
  }
  metrics = { ...requiredDefaults, ...metrics };
  const response = formatSuccessResponse(metrics);
  res.json(response);
}));

// GET /api/dashboard/waste-analysis - Get waste analysis
router.get('/waste-analysis', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const { startDate, endDate } = req.query;
  const wasteAnalysis = await analyticsService.calculateWaste(tenantId, startDate, endDate);
  const response = formatSuccessResponse(wasteAnalysis);
  res.json(response);
}));

// GET /api/dashboard/slow-moving - Get slow-moving items
router.get('/slow-moving', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const threshold = parseInt(req.query.days) || 7;
  const items = await analyticsService.getSlowMovingItems(tenantId, threshold);
  const response = formatSuccessResponse(items);
  res.json(response);
}));

// GET /api/dashboard/action-items - Get action items requiring attention
router.get('/action-items', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const actionItems = await analyticsService.getActionItems(tenantId);
  const response = formatSuccessResponse(actionItems);
  res.json(response);
}));

// GET /api/dashboard/labor-cost - Get labor cost analysis
router.get('/labor-cost', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const { startDate, endDate } = req.query;
  const laborCost = await analyticsService.calculateLaborCost(tenantId, startDate, endDate);
  const response = formatSuccessResponse(laborCost);
  res.json(response);
}));

// GET /api/dashboard/menu-profitability - Get menu profitability analysis
router.get('/menu-profitability', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const { startDate, endDate } = req.query;
  const menuProfitability = await analyticsService.getMenuProfitability(tenantId, startDate, endDate);
  const response = formatSuccessResponse(menuProfitability);
  res.json(response);
}));

// GET /api/dashboard/variance - Get variance detection analysis
router.get('/variance', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const { startDate, endDate } = req.query;
  const variance = await analyticsService.detectVariance(tenantId, startDate, endDate);
  const response = formatSuccessResponse(variance);
  res.json(response);
}));

// GET /api/dashboard/reports - Get available reports
router.get('/reports', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const reports = await analyticsService.getAvailableReports(tenantId);
  const response = formatSuccessResponse(reports);
  res.json(response);
}));

// POST /api/dashboard/export - Export report data
router.post('/export', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const { reportType, format, startDate, endDate } = req.body;
  const exportData = await analyticsService.exportReport(tenantId, reportType, format, startDate, endDate);
  const response = formatSuccessResponse(exportData);
  res.json(response);
}));

// GET /api/dashboard/alerts - Get all alerts (expiring items, low stock, etc.)
router.get('/alerts', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const alerts = await analyticsService.getAllAlerts(tenantId);
  const response = formatSuccessResponse(alerts);
  res.json(response);
}));

// GET /api/dashboard/monthly-report - Monthly Profit Report (POS-driven, executive summary, profit leaks, action plan)
router.get('/monthly-report', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const now = new Date();
  const year = parseInt(req.query.year, 10) || now.getFullYear();
  const month = parseInt(req.query.month, 10) || now.getMonth() + 1;
  const report = await monthlyReportService.getMonthlyProfitReport(tenantId, year, month);
  res.json(formatSuccessResponse(report));
}));

module.exports = router;
