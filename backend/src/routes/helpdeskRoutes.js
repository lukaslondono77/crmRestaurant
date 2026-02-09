const express = require('express');
const helpdeskService = require('../services/helpdeskService');
const { authenticate, tenantFilter } = require('../middleware/auth');
const { asyncHandler, formatSuccessResponse } = require('../utils/errorHandler');

const router = express.Router();

// Tickets routes
router.get('/tickets', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const filters = {
    assignedTo: req.query.assignedTo,
    createdBy: req.query.createdBy,
    status: req.query.status,
    priority: req.query.priority,
    category: req.query.category,
    search: req.query.search,
    page: req.query.page,
    limit: req.query.limit
  };
  const result = await helpdeskService.getTickets(tenantId, filters);
  res.json(formatSuccessResponse(result));
}));

router.get('/tickets/:id', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const ticketId = parseInt(req.params.id);
  const ticket = await helpdeskService.getTicketById(tenantId, ticketId);
  res.json(formatSuccessResponse(ticket));
}));

router.post('/tickets', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const userId = req.user.id;
  const ticket = await helpdeskService.createTicket(tenantId, userId, req.body);
  res.status(201).json(formatSuccessResponse(ticket));
}));

router.put('/tickets/:id', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const ticketId = parseInt(req.params.id);
  const ticket = await helpdeskService.updateTicket(tenantId, ticketId, req.body);
  res.json(formatSuccessResponse(ticket));
}));

router.delete('/tickets/:id', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const ticketId = parseInt(req.params.id);
  const result = await helpdeskService.deleteTicket(tenantId, ticketId);
  res.json(formatSuccessResponse(result));
}));

// Comments routes
router.post('/tickets/:ticketId/comments', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const ticketId = parseInt(req.params.ticketId);
  const userId = req.user.id;
  const comment = await helpdeskService.addComment(tenantId, ticketId, userId, req.body);
  res.status(201).json(formatSuccessResponse(comment));
}));

// Agents routes
router.get('/agents', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const agents = await helpdeskService.getAgents(tenantId);
  res.json(formatSuccessResponse(agents));
}));

router.post('/agents', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const { userId, ...agentData } = req.body;
  const agent = await helpdeskService.addAgent(tenantId, userId, agentData);
  res.status(201).json(formatSuccessResponse(agent));
}));

// Stats route
router.get('/stats', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const filters = {
    assignedTo: req.query.assignedTo,
    createdBy: req.query.createdBy
  };
  const stats = await helpdeskService.getTicketStats(tenantId, filters);
  res.json(formatSuccessResponse(stats));
}));

module.exports = router;
