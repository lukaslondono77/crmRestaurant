const express = require('express');
const eventsService = require('../services/eventsService');
const { authenticate, tenantFilter } = require('../middleware/auth');
const { asyncHandler, formatSuccessResponse } = require('../utils/errorHandler');

const router = express.Router();

// Events routes
router.get('/events', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const filters = {
    status: req.query.status,
    eventType: req.query.eventType,
    startDate: req.query.startDate,
    endDate: req.query.endDate,
    search: req.query.search,
    page: req.query.page,
    limit: req.query.limit
  };
  const result = await eventsService.getEvents(tenantId, filters);
  res.json(formatSuccessResponse(result));
}));

router.get('/events/:id', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const eventId = parseInt(req.params.id);
  const event = await eventsService.getEventById(tenantId, eventId);
  res.json(formatSuccessResponse(event));
}));

router.post('/events', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const userId = req.user.id;
  const event = await eventsService.createEvent(tenantId, userId, req.body);
  res.status(201).json(formatSuccessResponse(event));
}));

router.put('/events/:id', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const eventId = parseInt(req.params.id);
  const event = await eventsService.updateEvent(tenantId, eventId, req.body);
  res.json(formatSuccessResponse(event));
}));

router.delete('/events/:id', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const eventId = parseInt(req.params.id);
  const result = await eventsService.deleteEvent(tenantId, eventId);
  res.json(formatSuccessResponse(result));
}));

// Registration routes
router.post('/events/:eventId/register', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const eventId = parseInt(req.params.eventId);
  const userId = req.user.id;
  const registration = await eventsService.registerForEvent(tenantId, eventId, { userId, ...req.body });
  res.status(201).json(formatSuccessResponse(registration));
}));

router.get('/events/:eventId/registrations', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const eventId = parseInt(req.params.eventId);
  const filters = {
    status: req.query.status,
    paymentStatus: req.query.paymentStatus,
    page: req.query.page,
    limit: req.query.limit
  };
  const result = await eventsService.getEventRegistrations(tenantId, eventId, filters);
  res.json(formatSuccessResponse(result));
}));

// Speaker routes
router.post('/events/:eventId/speakers', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const eventId = parseInt(req.params.eventId);
  const speaker = await eventsService.addSpeaker(tenantId, eventId, req.body);
  res.status(201).json(formatSuccessResponse(speaker));
}));

// Session routes
router.post('/events/:eventId/sessions', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const eventId = parseInt(req.params.eventId);
  const session = await eventsService.addSession(tenantId, eventId, req.body);
  res.status(201).json(formatSuccessResponse(session));
}));

module.exports = router;
