const express = require('express');
const crmService = require('../services/crmService');
const { authenticate, tenantFilter } = require('../middleware/auth');
const { asyncHandler, formatSuccessResponse } = require('../utils/errorHandler');

const router = express.Router();

// Leads routes
router.get('/leads', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const filters = {
    userId: req.query.userId,
    status: req.query.status,
    source: req.query.source,
    search: req.query.search,
    page: req.query.page,
    limit: req.query.limit
  };
  const result = await crmService.getLeads(tenantId, filters);
  res.json(formatSuccessResponse(result));
}));

router.get('/leads/:id', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const leadId = parseInt(req.params.id);
  const lead = await crmService.getLeadById(tenantId, leadId);
  res.json(formatSuccessResponse(lead));
}));

router.post('/leads', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const lead = await crmService.createLead(tenantId, req.body);
  res.status(201).json(formatSuccessResponse(lead));
}));

router.put('/leads/:id', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const leadId = parseInt(req.params.id);
  const lead = await crmService.updateLead(tenantId, leadId, req.body);
  res.json(formatSuccessResponse(lead));
}));

router.delete('/leads/:id', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const leadId = parseInt(req.params.id);
  const result = await crmService.deleteLead(tenantId, leadId);
  res.json(formatSuccessResponse(result));
}));

// Deals routes
router.get('/deals', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const filters = {
    userId: req.query.userId,
    stage: req.query.stage,
    leadId: req.query.leadId,
    search: req.query.search,
    page: req.query.page,
    limit: req.query.limit
  };
  const result = await crmService.getDeals(tenantId, filters);
  res.json(formatSuccessResponse(result));
}));

router.get('/deals/:id', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const dealId = parseInt(req.params.id);
  const deal = await crmService.getDealById(tenantId, dealId);
  res.json(formatSuccessResponse(deal));
}));

router.post('/deals', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const deal = await crmService.createDeal(tenantId, req.body);
  res.status(201).json(formatSuccessResponse(deal));
}));

router.put('/deals/:id', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const dealId = parseInt(req.params.id);
  const deal = await crmService.updateDeal(tenantId, dealId, req.body);
  res.json(formatSuccessResponse(deal));
}));

router.delete('/deals/:id', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const dealId = parseInt(req.params.id);
  const result = await crmService.deleteDeal(tenantId, dealId);
  res.json(formatSuccessResponse(result));
}));

// Activities routes
router.get('/activities', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const filters = {
    leadId: req.query.leadId,
    dealId: req.query.dealId,
    contactId: req.query.contactId,
    activityType: req.query.activityType,
    isCompleted: req.query.isCompleted,
    page: req.query.page,
    limit: req.query.limit
  };
  const result = await crmService.getActivities(tenantId, filters);
  res.json(formatSuccessResponse(result));
}));

router.post('/activities', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const userId = req.user.id;
  const activity = await crmService.createActivity(tenantId, userId, req.body);
  res.status(201).json(formatSuccessResponse(activity));
}));

router.put('/activities/:id', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const activityId = parseInt(req.params.id);
  const activity = await crmService.updateActivity(tenantId, activityId, req.body);
  res.json(formatSuccessResponse(activity));
}));

// Stats route
router.get('/stats', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const filters = {
    userId: req.query.userId
  };
  const stats = await crmService.getCrmStats(tenantId, filters);
  res.json(formatSuccessResponse(stats));
}));

module.exports = router;
